import { getClassForGuid, getGuid, type ClassConstructor, type ClassDecoratorMap } from "../decorator-registry";
import { EntityDecorators, EntityValidationError, getTypeOf, PropertyValidationError, type ModelDefinition, type ModelMetadata, type PropertyMetadata } from "./types";

const getListDifferences = (list1: any[], list2: any[]) => {
    return new Set(list1).difference(new Set(list2));
}

/**
 * Applies @Property validation to specifications.
 */
export const standardPropertyValidation = (value: any, propertyName: string, propMeta: Partial<PropertyMetadata>, emid: string) => {
    const { isRequired, isTypeOf, isArray, fixedValues } = propMeta;
    let errors: string[] = [];
    const errProperties: Record<string, string> = {};
    const _valType = getTypeOf(value);

    // case: assert isRequired (!undefined && !null)
    if (isRequired && (value === undefined || value === null)) {
        errors.push(`property-required (actual: ${_valType})`)
    }

    if (!(value !== undefined && value !== null)) {
        if (errors.length > 0) {
            return new PropertyValidationError({
                property: propertyName,
                message: errors.join('; '),
                contextName: emid,
                properties: errProperties
            });
        }
        return undefined;
    }

    // case: assert isArray on value
    if (isArray && !Array.isArray(value)) {
        errors.push(`property-array (actual: ${_valType})`);
    } else if (!isArray && Array.isArray(value)) {
        errors.push(`property-not-array (set \`isArray\`)`);
    } else if (fixedValues) {
        const vals = value instanceof Array ? value : [value];
        const diff = getListDifferences(vals.map(v => `${v}`), Object.keys(fixedValues))
        if (diff.size > 0) {
            errors.push(`property-fixedValues (not-allowed: ${[...diff].join('; ')})`);
            errProperties[propertyName] = Object.keys(fixedValues).join('; ');
        }
    }

    const _isTypeOf = !isTypeOf ? [] : (typeof isTypeOf === 'string' ? [isTypeOf] : isTypeOf);
    if (_isTypeOf.length > 0 && _isTypeOf[0] !== '*') {
        let valTypes = [];
        if (isArray) {
            valTypes = value.map(getTypeOf);
        } else {
            valTypes = [getTypeOf(value)];
        }

        if (valTypes.length > 0 && getListDifferences(valTypes, _isTypeOf).size > 0) {
            errors.push(`property-typeOf-[${_isTypeOf.join(', ')}] (actual: [${valTypes.join(', ')}])`);
        }
    }

    if (errors.length > 0) {
        return new PropertyValidationError({
            property: propertyName,
            message: errors.join('; '),
            contextName: emid,
            properties: errProperties
        });
    }

    return propMeta.validate?.(value, propertyName);
}

/**
 * Injects setters for whitelisted properties on the given target (typically a function prototype)
 */
export const makeValidatingPropertyAccessors = (args: { target: any, emid: string, propsMetaMap: Record<string, PropertyMetadata> }) => {
    const { target, emid, propsMetaMap } = args;
    for (const [propName, propMeta] of Object.entries(propsMetaMap)) {
        if (Object.hasOwn(target, propName)) {
            delete target[propName];
        }
        // !Object.hasOwn(target, propName) &&
        Object.defineProperty(target, propName, {
            enumerable: true,
            set(value) {
                this.$__proxy[propName] = value;
                const error = standardPropertyValidation(value, propName, propMeta as PropertyMetadata, emid);
                if (error) {
                    this.$__errorState[propName] = error.toJson();
                    throw error;
                } else {
                    delete this.$__errorState[propName];
                }
            },
            get() { return this.$__proxy[propName]; },
        });
    }
    return target;
}

/**
 * Applies property validation on the @Model instance with an explicit ModelDefinition with the following rules:
 * 
 * @param entity 
 * @param modelDef 
 * @returns Root `propertyName` is `{modelDef.collection}@{modelDef.name}` and `payload` elements are 
 * `{ propertyName: {propertyName} }`
 */
export const standardEntityValidation = (emid: string, propsMetaMap: Record<string, PropertyMetadata>, entity: any) => {
    if (!entity) throw new Error('entity undefined');

    const errors: Record<string, any> = {};
    for (const [propName, propDef] of Object.entries(propsMetaMap)) {
        const error = standardPropertyValidation(entity[propName], propName, propDef, emid);
        if (error) {
            errors[propName] = error.toJson();
        }
    }

    if (Object.keys(errors).length == 0)
        return undefined;

    return new EntityValidationError('entity-validation-failed: see properties', emid, errors)
}


type ProxyEntity = {
    $__proxy: Record<string, any>;
    $__errorState: Record<string, any>;
}

export const assertValidEntity = (entity: ProxyEntity, emid: string, allDecs: ClassDecoratorMap) => {
    if (Object.keys(entity.$__errorState).length > 0) {
        throw new EntityValidationError(
            'entity-validation-failed: see properties',
            emid,
            entity.$__errorState
        );
    }

    const validatorInstMethod = Object.keys(allDecs.methods?.[EntityDecorators.Validator] ?? {})[0];
    const validatorStaticMethod = Object.keys(allDecs.methodsStatic?.[EntityDecorators.Validator] ?? {})[0];
    const anyentity = entity as any;
    let error: any;
    if (validatorInstMethod) {
        console.log('invoking instance validator', validatorInstMethod, ' >>>>', anyentity);
        error = anyentity[validatorInstMethod]();
    } else if (validatorStaticMethod) {
        error = anyentity.constructor[validatorStaticMethod](entity);
    }
    error = error ?? standardEntityValidation(
        emid,
        (allDecs.properties[EntityDecorators.Property] ?? {}) as Record<string, PropertyMetadata>,
        entity
    );

    if (error) throw error;
}

export const makeStandardEntityAccessors = (constructorFn: ClassConstructor<any>, emid: string, allDecs: ClassDecoratorMap) => {
    const meta = allDecs.class[EntityDecorators.Model];
    const idKey = meta.idKey ?? 'id';

    const newClass = class extends constructorFn {
        $__proxy: Record<string, any> = {};
        $__errorState: Record<string, any> = {};

        constructor(...args: any[]) {
            super(...args);
            makeValidatingPropertyAccessors({
                target: this,
                emid,
                propsMetaMap: (allDecs.properties[EntityDecorators.Property] ?? {}) as Record<string, PropertyMetadata>,
            })
        }

        get $id() {
            return idKey;
        }

        get $emid() {
            return emid;
        }

        $assertValidEntity() {
            assertValidEntity(this, emid, allDecs);
        }
    };

    return newClass;
}

/**
 * Creates a ModelDefinition instance from a ClassDecoratorMap. The modelDef operates on
 * concrete objects and does not bind in any way to the instance/class definition.
 */
export const makeModelDefinition = (allDecs: ClassDecoratorMap): ModelDefinition => {
    const modelMeta = allDecs.class[EntityDecorators.Model] as ModelMetadata;
    const emid = `${modelMeta.collection}@${modelMeta.name}`;
    const propsForDecorator = allDecs.properties[EntityDecorators.Property] ?? {};
    const guid = allDecs.guid;

    const properties = Object.entries(propsForDecorator).reduce((acc, [property, metadata]) => {
        const { decode = (v: any) => v, encode = (v: any) => v, validate: validateFn = () => undefined, ...rest } = metadata;
        acc[property] = {
            name: metadata.name ?? property,
            decode,
            encode,
            validate: (value: any, propDefName) =>
                standardPropertyValidation(value, propDefName, metadata as PropertyMetadata, emid),
            ...rest
        };
        return acc;
    }, {} as ModelDefinition['properties']);

    const modelDef: ModelDefinition = {
        modelMetadata: modelMeta,
        properties,
        getEmid: () => emid,
        createInstance: () => new (getClassForGuid(guid))(),
    }

    return modelDef;
}
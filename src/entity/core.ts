import { DEFAULT_COLLECTION, EntityValidationError, PropertyValidationError, type PropertyMetadata } from "./types";


const _mytype = (v: any) => v === null ? 'null' : typeof v;

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

    const _valType = _mytype(value);

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
            valTypes = value.map(_mytype);
        } else {
            valTypes = [_mytype(value)];
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
export const makeValidatingPropertyAccessors = (target: any, emid: string, propsMetaMap: Record<string, PropertyMetadata> = {}, proxy: Record<string, any> = {}) => {
    for (const [propName, propMeta] of Object.entries(propsMetaMap)) {
        Object.defineProperty(target, propName, {
            enumerable: true,
            set(value) {
                const error = standardPropertyValidation(value, propName, propMeta as PropertyMetadata, emid);
                if (error) throw error;
                proxy[propName] = value;
            },
            get() { return proxy[propName]; },
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

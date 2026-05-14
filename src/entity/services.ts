import { profile } from "node:console";
import { getClassDecoratorMap, getClassForGuid, getGuid, getInheritedClassDecoratorMap, type ClassDecoratorMap } from "../decorator-registry";
import { EntityDecorators, EntityValidationError, PropertyValidationError, type EntityValidatorFn, type ModelDefinition, type PropertyMetadata } from "./decorators";

export const passthruDecode = (value: any) => value;
export const passthruEncode = (value: any) => value;

export const standardPropertyValidation = (value: any, propertyName: string, modelDef: ModelDefinition) => {
    const { isRequired, isTypeOf, isArray } = modelDef.properties[propertyName];
    let errors: string[] = [];

    // case: assert isRequired (!undefined && !null)
    if (isRequired && value === undefined || value === null) {
        errors.push(`property-required (actual: undefined OR null)`)
    }

    let sampleValue = value;
    // case: assert isArray on value
    if (isArray) {
         if (!Array.isArray(value)) {
            errors.push(`property-array (expected: array, actual: ${typeof value})`);
         } else {
            // case: assert isTypeOf on first array value
            // unsupported: multi-type checking on multiple values: must be done by caller via @Validator if required
            sampleValue = value[0];
         }
    }

    // case: since isRequired enforces value !== undefined, we will only check type if value
    // is not undefined (this allows for optional properties where `null` is an explictly allowed value).
    // @todo allow `!type` syntax?
    if (isTypeOf && sampleValue !== undefined) {
        const stype = typeof sampleValue;
        if ((!isTypeOf.includes(stype) || !isTypeOf.includes('*'))) {
            errors.push(`property-typeOf (expected: [${isTypeOf.join(', ')}], actual: ${stype})`)
        }
    }

    if (errors.length > 0) {
        return new PropertyValidationError(propertyName, errors.join('; '), modelDef.getModelId());
    }

    return undefined;
};

/**
 * Applies property validation on the @Model instance with an explicit ModelDefinition.
 * @param entity 
 * @param modelDef 
 * @returns Root `propertyName` is `{modelDef.collection}@{modelDef.name}` and `payload` elements are 
 * `{ propertyName: {propertyName} }`
 */
export const standardEntityValidation: EntityValidatorFn = (modelDef, entity) => {
    const emid = modelDef.getModelId();
    const errors: Record<string, any> = {};
    for (const [propName, propDef] of Object.entries(modelDef.properties)) {
        const error = propDef.validate(entity[propName], propName, modelDef);
        if (error) {
            errors[propName] = error.toJson();
        }
    }
    
    if (Object.keys(errors).length == 0)
        return undefined;

    return new EntityValidationError('entity-validation-failed: see properties', emid, errors)
}

const modelDefCache: Record<string, ModelDefinition> = {};

/**
 * Creates a ModelDefinition instance from a ClassDecoratorMap. The modelDef operates on
 * concrete objects and does not bind in any way to the instance/class definition.
 */
export const makeModelDefinition = (allDecs: ClassDecoratorMap): ModelDefinition => {
    const modelMeta = allDecs.class[EntityDecorators.Model];
    const emid = `${modelMeta.collection}@${modelMeta.name}`;
    const propsForDecorator = allDecs.properties[EntityDecorators.Property] ?? {};
    const guid = allDecs.guid;
    
    const validatorInstMethod = Object.keys(allDecs.methods[EntityDecorators.Validator])[0];
    const validatorStaticMethod = Object.keys(allDecs.methodsStatic[EntityDecorators.Validator])[0];

    const properties = Object.entries(propsForDecorator).reduce((acc, [property, metadata]) => {
        const { decode = passthruDecode, encode = passthruEncode, validate: validateFn = () => undefined } = metadata;
        acc[property] = {
            name: metadata.name ?? property,
            decode,
            encode,
            validate: (value: any) => {
                return standardPropertyValidation(value, property, modelDef) ?? validateFn(value, property, modelDef);
            },
            ...metadata
        };
        return acc;
    }, {} as ModelDefinition['properties']);

    const validateEntity = (entity: any) => {
        if (validatorInstMethod && entity[validatorInstMethod]) {
            return entity[validatorInstMethod](modelDef);
        } else if (validatorStaticMethod && entity.constructor[validatorStaticMethod]) {
            return entity.constructor[validatorStaticMethod](modelDef, entity);
        }
        return standardEntityValidation(modelDef, entity);
    }

    const hydrateEntity = (fromData: Record<string, any>) => {
        const entity = new (getClassForGuid(guid))();
        for (const property in properties) {
            entity[property] = properties[property].decode(fromData[property], property, modelDef);
        }
        return entity;
    }

    const dehydrateEntity = (entity: any) => {
        const data: Record<string, any> = {};
        for (const property in properties) {
            data[property] = properties[property].encode(entity[property], property, modelDef);
        }
        return data;
    }

    const modelDef: ModelDefinition = {
        // cursor was complaining about name/collection not explicitly defined. why???
        name: modelMeta.name,
        collection: modelMeta.collection,
        ...modelMeta,
        properties,
        getModelId: () => emid,
        validateEntity,
        hydrateEntity,
        dehydrateEntity,
    }

    return modelDef;
}

/**
 * Gets/creates a static ModelDefinition object from inherited @Model classes.
 * @param clazz 
 * @returns 
 */
export const getModelDefinition = (clazz: any) => {
    const guid = getGuid(clazz);
    const cacheKey = guid;

    // console.log('1. getModelDefinition cacheKey=', cacheKey, '->', modelDefCache[cacheKey], clazz);
    if (modelDefCache[cacheKey]) return modelDefCache[cacheKey];

    // console.log('2. getModelDefinition get decMap', 'guid=',getGuid(clazz)?.toString());
    const allDecs = getInheritedClassDecoratorMap(clazz, [EntityDecorators.Model, EntityDecorators.Property, EntityDecorators.Validator]);
    if (!allDecs) return;

    modelDefCache[cacheKey] = makeModelDefinition(allDecs);
    // console.log('3. getModelDefinition SET: cacheKey=', cacheKey, '->', modelDefCache[cacheKey]);
    return modelDefCache[cacheKey];
}

export const getModelDefinitionByGuid = (guid: string) => {
    const clazz = getClassForGuid(guid);
    if (!clazz) return undefined;
    return getModelDefinition(clazz);
}
import { getClassDecoratorMap, getGuid, getInheritedClassDecoratorMap, type ClassDecoratorMap } from "../decorator-registry";
import { EntityDecorators, ValidationError, type EntityValidatorFn, type ModelDefinition, type PropertyMetadata } from "./decorators";

export const passthruDecode = (value: any, modelDef: ModelDefinition) => value;
export const passthruEncode = (value: any, modelDef: ModelDefinition) => value;

export const standardPropertyValidation = (value: any, propertyName: string, modelDef: ModelDefinition) => {
    const { isRequired, isTypeOf } = modelDef.properties[propertyName];
    let errors: string[] = [];
    if (isRequired && value === undefined || value === null) {
        errors.push(`property-required (actual: undefined OR null)`)
    }
    if (isTypeOf && !isTypeOf.includes(typeof value)) {
        errors.push(`property-type-of (expected: [${isTypeOf.join(', ')}], actual: ${typeof value})`)
    }
    if (errors.length > 0) {
        return new ValidationError(propertyName, errors.join('; '));
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
    const entityId = `${modelDef.collection}@${modelDef.name}`;
    const errors: ValidationError[] = [];
    for (const property in modelDef.properties) {
        const error = modelDef.properties[property].validate(entity[property], property, modelDef);
        if (error) {
            errors.push(error);
        }
    }
    if (errors.length == 0) return;
    return new ValidationError(entityId, 'entity-validation-failed', errors)
}

const modelDefCache: Record<string, ModelDefinition> = {};

/**
 * Creates a ModelDefinition instance from a ClassDecoratorMap. The modelDef operates on
 * concrete objects and does not bind in any way to the instance/class definition.
 */
export const makeModelDefinition = (allDecs: ClassDecoratorMap): ModelDefinition => {
    const modelMeta = allDecs.class[EntityDecorators.Model];
    const propsForDecorator = allDecs.properties[EntityDecorators.Property] ?? {};
    
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

    const modelDef: ModelDefinition = {
        // cursor was complaining about name/collection not explicitly defined. why???
        name: modelMeta.name,
        collection: modelMeta.collection,
        ...modelMeta,
        properties,
        validateEntity,
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
    const allDecs = getInheritedClassDecoratorMap(clazz, [EntityDecorators.Model, EntityDecorators.Property, EntityDecorators.Validator]);
    if (!allDecs) return;

    const cacheKey = guid.toString();
    if (modelDefCache[cacheKey]) return modelDefCache[cacheKey];

    modelDefCache[cacheKey] = makeModelDefinition(allDecs);
    return modelDefCache[cacheKey];
}
/**
 * 
 * @param modelInst A user-supplied @Model instance.
 * @param partialEntityData Typically a JSON object from a datasource. This should match the encoding/decoding standards of the instance.
 * @returns 
 */
export const hydrateModelFromData = <T = any>(modelInst: any, partialEntityData: any, overrideDef?: ModelDefinition): undefined | T => {
    const modelDef = overrideDef ?? getModelDefinition(modelInst);
    if (!modelDef) return undefined;

    for (const property in modelDef.properties) {
        const propDef = modelDef.properties[property];
        modelInst[property] = propDef.decode(partialEntityData[property], modelDef);
    }
    return modelInst as T;
}
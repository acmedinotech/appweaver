import { getClassDecoratorMap, getGuid, registerClassDecorator, registerMethodDecorator, registerPropertyDecorator } from "../decorator-registry";

export enum EntityDecorators {
    Model = 'entity.Model',
    Property = 'entity.Property',
    Validator = 'entity.Validator',
}

export type ModelMetadata = {
    name: string;
    collection?: string;
    relations?: any;
}

export const DEFAULT_COLLECTION = 'appweaver.default';

/**
 * CLASS DECORATOR: Defines an entity @Model.
 * @param metadata 
 * @returns 
 */
export const Model = (metadata: ModelMetadata) => {
    return (target: any) => {
        registerClassDecorator(EntityDecorators.Model, target, metadata);
    };
};

export class ValidationError extends Error {
    propertyName: string;
    payload?: any;
    constructor(property: string, message: string, payload?: any) {
        super(`${property}: ${message}`);
        this.propertyName = property;
        this.payload = payload;
    }
}

export type PropertyMetadata = {
    name: string;
    isRequired?: boolean;
    // @todo isReadOnly?: boolean;
    isTypeOf?: ('string' | 'number' | 'boolean' | 'object' | 'array' | 'date' | 'function' | 'symbol' | 'undefined' | 'null' | 'bigint')[];
    /**
     * Context-dependent value transformation. E.g. a Web form field might display a complex object from a JSON string.
     */
    decode: (value: any, modelDef: ModelDefinition) => any;
    /**
     * Context-dependent value transformation. E.g. a form handler might convert a complex object to a JSON string.
     */
    encode: (value: any, modelDef: ModelDefinition) => any;
    /**
     * Property validation. If undefined, the property is assumed to be valid. Otherwise, passes return value to caller.
     */
    validate: (value: any, property: string, modelDef: ModelDefinition) => undefined | ValidationError;
}

/**
 * METHOD DECORATOR: Use on an instance or static method. Function must conform to {@see EntityValidatorFn} signature.
 */
export const Validator  = () => {
    return (target: any, propertyKey: string, _: PropertyDescriptor) => {
        registerMethodDecorator(EntityDecorators.Validator, target, propertyKey, {});
    };
}

/**
 * PROPERTY DECORATOR: Defines @Property encoding/validation rules on a @Model
 * @param metadata 
 * @returns 
 */
export const Property = (metadata: Partial<PropertyMetadata>) => {
    return (target: any, propertyKey: string) => {
        registerPropertyDecorator(EntityDecorators.Property, target, propertyKey, {name: propertyKey, ...metadata});
    };
};

/**
 * @param modelDef 
 * @param entity If undefined, convention dictates that `this` is an instance method of a @Model class.
 * @returns 
 */
export type EntityValidatorFn = (modelDef: ModelDefinition, entity?: any) => undefined | ValidationError;

export interface ModelDefinition extends ModelMetadata {
    properties: Record<string, PropertyMetadata>;
    validateEntity: EntityValidatorFn;
}
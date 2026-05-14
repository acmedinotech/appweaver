import { AppWeaverError } from "../constants";
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

const collectionToGuids: Record<string, string[]> = {};
const modelToGuid: Record<string, string> = {};

export const getModelDefinitionGuid = (name: string, collection = DEFAULT_COLLECTION) => modelToGuid[`${collection}@${name}`];
export const getModelDefinitionsByCollection = (collection = DEFAULT_COLLECTION) => collectionToGuids[collection] ?? [];

/**
 * CLASS DECORATOR: Defines an entity @Model.
 * @param metadata 
 * @returns 
 */
export const Model = (metadata: ModelMetadata) => {
    return (target: any) => {
        const meta = {collection: DEFAULT_COLLECTION, ...metadata};
        registerClassDecorator(EntityDecorators.Model, target, meta);
        
        const key = `${meta.collection}@${meta.name}`;
        if (!collectionToGuids[meta.collection]) {
            collectionToGuids[meta.collection] = [];
        }
        const guid = getGuid(target);
        collectionToGuids[meta.collection].push(guid);
        modelToGuid[key] = guid;
    };
};

export class PropertyValidationError extends AppWeaverError {
    static readonly errorType = 'entity.property.validation-error';
    propertyName: string;
    
    constructor(property: string, message: string, contextName: string = PropertyValidationError.errorType) {
        super(message, contextName);
        this.propertyName = property;
    }

    toJson() {
        return {
            ...super.toJson(),
            propertyName: this.propertyName,
        }
    }
}

export class EntityValidationError extends AppWeaverError {
    static readonly errorType = 'entity.validation-error';
    constructor(message: string, contextName: string = EntityValidationError.errorType, properties?: Record<string, any>) {
        super(message, contextName, properties);
    }
}

const _typeof = typeof undefined;

export type PropertyMetadata = {
    name: string;
    isRequired?: boolean;
    isReadOnly?: boolean;
    isArray?: boolean;
    isTypeOf?: (typeof _typeof | '*')[];
    /**
     * Context-dependent value transformation. E.g. a Web form field might display a complex object from a JSON string.
     */
    decode: (value: any, property: string, modelDef: ModelDefinition) => any;
    /**
     * Context-dependent value transformation. E.g. a form handler might convert a complex object to a JSON string.
     */
    encode: (value: any, property: string, modelDef: ModelDefinition) => any;
    /**
     * Property validation. If undefined, the property is assumed to be valid. Otherwise, passes return value to caller.
     */
    validate: (value: any, property: string, modelDef: ModelDefinition) => undefined | PropertyValidationError;
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
export type EntityValidatorFn = (modelDef: ModelDefinition, entity?: any) => undefined | AppWeaverError;

export interface ModelDefinition extends ModelMetadata {
    properties: Record<string, PropertyMetadata>;
    getModelId: () => string;
    validateEntity: EntityValidatorFn;
    hydrateEntity: (fromData: Record<string, any>) => any;
    dehydrateEntity: (entity: any) => Record<string, any>;
}
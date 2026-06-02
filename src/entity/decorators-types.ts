import { AppWeaverError } from "../constants";
import { getClassDecoratorMap, getGuid, registerClassDecorator, registerMethodDecorator, registerPropertyDecorator } from "../decorator-registry";

export enum EntityDecorators {
    Model = 'entity.Model',
    Property = 'entity.Property',
    Validator = 'entity.Validator',
}

export type ModelMetadata = {
    name: string;
    idKey?: string;
    collection?: string;
    relations?: any;
}

export const DEFAULT_COLLECTION = 'appweaver.default';

const collectionToGuids: Record<string, string[]> = {};
const modelToGuid: Record<string, string> = {};

export const getModelDefinitionGuid = (name: string, collection = DEFAULT_COLLECTION) => modelToGuid[`${collection}@${name}`];
export const getModelGuidByEmid = (emid: string) => modelToGuid[emid];
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
    
    constructor({property, message, contextName = PropertyValidationError.errorType}: {property: string, message: string, contextName?: string}) {
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

/**
 * Contains a set  of rules for a `@Property` that tooling can use for auto-normalization/validation
 * against user-supplied data.
 */
export type PropertyMetadata = {
    name: string;
    /** If true, the property is always required before validation. ONLY use this on user-supplied fields.  */
    isRequired?: boolean;
    /** If true, the property cannot be modified after creation. ONLY use this on user-supplied fields. */
    isReadOnly?: boolean;
    /** If true and autoCreatedValue set, the property is auto-created by the system at create (conflicts with isRequired/isReadOnly). */
    isAutoCreated?: boolean;
    /** If true and autoUpdatedValue set, the property is auto-updated by the system at update (conflicts with isRequired/isReadOnly). */
    isAutoUpdated?: boolean;
    /** If true, the property is an array. If object, define array constraints. */
    isArray?: true | {
        /** If set, enforce a minimum number of selected options. */
        minSelected?: number;
        /** If set, enforce a maximum number of selected options. */
        maxSelected?: number;
    };
    /** If defined, restricts values to the specified types (`*` allows any type). */
    isTypeOf?: (typeof _typeof | '*')[];
    /**
     * If set, property value must exist as a key in the map. Map is `value -> label`.
     * (This could be used with checkboxes, dropdowns, etc.)
     */
    fixedValues?: Record<string, any>;
    /** WIP */
    relationship?: ({
        relType: 'embedded'
        } | {
        relType:'child' | 'parent' | 'ref'
        /** A set of property names to save for foreign/reference relationships. */
        preservedProps: string[];
    }) & {
        emid?: string;
        /**
         * List of: `model`, `collection@model`, `model*`, `collection@*`. Invert logic with `!` prefix.
         * */
        emidConstraints?: string[]
    }
    autoCreatedValue?: (propertyKey: string, modelDef: ModelDefinition) => any;
    autoUpdatedValue?: (propertyKey: string, modelDef: ModelDefinition) => any;
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
export const Property = (metadata: Partial<PropertyMetadata> = {}) => {
    return (target: any, propertyKey: string) => {
        registerPropertyDecorator(EntityDecorators.Property, target, propertyKey, {name: propertyKey, ...metadata});
    };
};

/**
 * @param entity If undefined, convention dictates that `this` is the entity
 * @param modelDef If undefined, convention dictates that method contains a default modelDef (or returns undefined)
 * @returns 
 */
export type EntityValidatorFn = ( modelDef: ModelDefinition, entity?: object) => undefined | AppWeaverError;

export type IdExtractorFn = (entity: any, keys: string[], propMeta: PropertyMetadata, modelDef?: ModelDefinition) => Record<string, any>;

export type HydrateOptions = {
    /** If true, no enhancements (e.g. injecting StandardEntity methods) are applied to the entity. */
    isSparse?: boolean;
}

export type DehydrateOptions = {
    idExtractor?: IdExtractorFn;
    depth?: number;
}

export interface StandardEntity {
    $id: () => string|undefined;
    $emid: () => string;
    $assertValidEntity: () => void;
}

export interface ObservableEntity {
    /**
     * @param observer 
     * @param onProperties If undefined or `*`, observe all properties. Otherwise, observe explicit key(s).
     * @returns Unsubscribe function.
     */
    $observeWith: (observer: PropertyObserverFn, onProperties?: string|string[]) => () => void;
}

export type PropertyObserverFn = (property: string, value: any) => void;

/**
 * Provides hydration/validation/dehydration lifecycle management
 */
export interface ModelDefinition extends ModelMetadata {
    properties: Record<string, PropertyMetadata>;
    getModelId: () => string;
    createInstance: () => any;
    validateEntity: EntityValidatorFn;
    hydrateEntity: <Entity=object>(fromData: Record<string, any>, options?: HydrateOptions) => Entity & StandardEntity;
    dehydrateEntity: (entity: any, options?: DehydrateOptions) => Record<string, any>[];
    removeReadOnly: (data: Record<string, any>) => Record<string, any>;
    /**
     * Performs secure data enhancement & cleanup as follows::
     * - inject additional data defined in options.injectData
     * - if mode=='create': remove all auto-generated properties
     *   - else: remove all read-only properties
     * - remove additional properties defined in options.removeKeys
     */
    prepareData: (mode: 'create' | 'update', data: any, options?: { injectData?: Record<string, any>; removeKeys?: string[]}) => {
        /** Persistence-ready user data. */
        data: Record<string, any>;
        /** User-supplied key-values that were removed from data. */
        removed: Record<string, any>;
    }
}

// @todo move to services
export const hydrateAndValidateEntity = (modelDef: ModelDefinition, fromData: Record<string, any>) => {
    const entity = modelDef.hydrateEntity(fromData);
    const error = modelDef.validateEntity(modelDef, entity);
    if (error) { throw error; }
    return entity;
}

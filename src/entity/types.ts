import { AppWeaverError } from "../constants";

export class PropertyValidationError extends AppWeaverError {
    static readonly errorType = 'entity.property.validation-error';
    propertyName: string;

    constructor({ property, message, properties, contextName = PropertyValidationError.errorType }: { property: string, message: string, contextName?: string; properties?: Record<string, any> }) {
        super(message, contextName);
        this.propertyName = property;
        this.properties = properties;
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

    toJson() {
        if (!this.properties) return super.toJson();
        return {
            ...super.toJson(),
            properties: Object.fromEntries(Object.entries(this.properties).map(([key, value]) => {
                return [key, value.toJson ? value.toJson() : value];
            })),
        }
    }
}

export const DEFAULT_COLLECTION = 'appweaver.default';

export enum EntityDecorators {
    Model = 'entity.Model',
    Property = 'entity.Property',
    Validator = 'entity.Validator',
}

export type ModelMetadata = {
    name: string;
    collection?: string;
    idKey?: string;
    /**
     * Hidden properties that should be preserved.
     */
    preserveKeys?: string[];
    /**
     * Hidden properties that should be ignored (applied after preserveKeys).
     */
    ignoreKeys?: string[];
    /**
     * During hydration, this will be applied before any property's `decode`
     */
    initialDecode?: (value: any, property: string) => any;
    /**
     * During dehydration, this will be applied after any property's `encode`
     */
    finalEncode?: (value: any, property: string) => any;
}

/**
 * Provides model instance creating & metadata.
 */
export interface ModelDefinition {
    modelMetadata: ModelMetadata;
    properties: Record<string, PropertyMetadata>;
    getEmid: () => string;
    createInstance: () => any;
}

/**
 * Provides model preparation/hydration/dehydration lifecycle management.
 */
export interface EntityLifecycleManager {
    prepareData: (args: {
        mode: 'create' | 'update';
        userData: Record<string, any>;
        appData?: Record<string, any>;
    }) => {
        /** Persistence-ready user data. */
        data: Record<string, any>;
        /** User-supplied key-values that were removed from data. */
        removed: Record<string, any>;
    }
    hydrateEntity: <Entity = object>(args: {
        data: Record<string, any>;
        entity?: Entity;
        options?: HydrateOptions
    }) => Entity & StandardEntity;
    dehydrateEntity: (args: {
        entity: any;
        data?: Record<string, any>;
        options?: DehydrateOptions;
    }) => Record<string, any>[];
}

export interface StandardEntity {
    $id: string | undefined;
    $emid: string;
    $assertValidEntity: () => void;
}

export const asStandardEntity = <Ent extends object>(entity: any) => entity as Ent & StandardEntity;

export const isStandardEntity = (entity: any): entity is StandardEntity => {
    return entity && typeof entity.$id === 'string' && typeof entity.$emid === 'string' && typeof entity.$assertValidEntity === 'function';
}

/**
 * @param entity If undefined, convention dictates that `this` is the entity
 * @param modelDef If undefined, convention dictates that method contains a default modelDef (or returns undefined)
 * @returns 
 */
export type EntityValidatorFn = (modelDef: ModelDefinition, entity?: object) => undefined | AppWeaverError;

export type TypeOfs = '*' | 'string' | 'number' | 'boolean' | 'null' | 'bigint' | 'symbol' | 'object' | 'function';

export const getTypeOf = (value: any) => value === null ? 'null' : typeof value;

export type PropMutationMetadata = {
    /** If true, the property cannot be modified after creation. ONLY use this on user-supplied fields. */
    isReadOnly?: boolean;
    /** If true and autoCreatedValue set, the property is auto-created by the system at create (conflicts with isRequired/isReadOnly). */
    isAutoCreated?: boolean;
    /** If true and autoUpdatedValue set, the property is auto-updated by the system at update (conflicts with isRequired/isReadOnly). */
    isAutoUpdated?: boolean;
    /** If true, the property is an array. If object, define array constraints. */
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
};

export type PropValidationMetadata = {
    /** If true, the property is always required before validation. ONLY use this on user-supplied fields.  */
    isRequired?: boolean;
    isArray?: true | {
        /** If set, enforce a minimum number of selected options. */
        minSelected?: number;
        /** If set, enforce a maximum number of selected options. */
        maxSelected?: number;
    };
    /** If defined, restricts values to the specified types (`*` allows any type). */
    isTypeOf?: TypeOfs[];
    /**
     * If set, property value must exist as a key in the map. Map is `value -> label`.
     * (This could be used with checkboxes, dropdowns, etc.)
     */
    fixedValues?: Record<string, any>;
    /** WIP */
    relationship?: ({
        relType: 'embedded'
    } | {
        relType: 'child' | 'parent' | 'ref'
        /** A set of property names to save for foreign/reference relationships. */
        preservedProps: string[];
    }) & {
        emid?: string;
        /**
         * List of: `model`, `collection@model`, `model*`, `collection@*`. Invert logic with `!` prefix.
         * */
        emidConstraints?: string[]
    }
    /**
     * Property validation. If undefined, the property is assumed to be valid. Otherwise, passes return value to caller.
     */
    validate: (value: any, property: string) => undefined | PropertyValidationError;
    /**
     * If defined, allows function to modify set value before it's stored on entity. Use cases include
     * enforcing a minimally valid value (e.g. array must always have 1 item).
     */
    setMap?: (value: any, property: string) => any;
};

/**
 * Contains a set  of rules for a `@Property` that tooling can use for auto-normalization/validation
 * against user-supplied data.
 */
export type PropertyMetadata = {
    name: string;
} & PropMutationMetadata & PropValidationMetadata;

export type IdExtractorFn = (entity: any, keys: string[], propMeta: PropertyMetadata, modelDef?: ModelDefinition) => Record<string, any>;

export type HydrateOptions = {
    /** If true, no enhancements (e.g. injecting StandardEntity methods) are applied to the entity. */
    isSparse?: boolean;
    /** If true, the entity will be hydrated incrementally. */
    queueEntityFetch?: (params: { entity: any, parent: any, key: string, ord?: number }) => void;
}

export type DehydrateOptions = {
    idExtractor?: IdExtractorFn;
    depth?: number;
    preserveKeys?: string[];
}

export interface ObservableEntity {
    /**
     * @param observer 
     * @param onProperties If undefined or `*`, observe all properties. Otherwise, observe explicit key(s).
     * @returns Unsubscribe function.
     */
    $observeWith: (observer: PropertyObserverFn, onProperties?: string | string[]) => () => void;
}

export const asObservableEntity = <Ent extends object>(entity: any) => entity as Ent & ObservableEntity;

export type PropertyObserverFn = (params: { property: string, value: any; error?: any }) => void;

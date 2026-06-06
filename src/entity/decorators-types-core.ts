import { AppWeaverError } from "../constants";
import { getClassDecoratorMap, getGuid, registerClassDecorator, registerMethodDecorator, registerPropertyDecorator } from "../decorator-registry";

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
    notValidateOnSet?: boolean;
}

/**
 * Provides hydration/validation/dehydration lifecycle management
 */
export interface ModelDefinition extends ModelMetadata {
    properties: Record<string, PropertyMetadata>;
    getEmid: () => string;
    createInstance: () => any;
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

/**
 * @param entity If undefined, convention dictates that `this` is the entity
 * @param modelDef If undefined, convention dictates that method contains a default modelDef (or returns undefined)
 * @returns 
 */
export type EntityValidatorFn = ( modelDef: ModelDefinition, entity?: object) => undefined | AppWeaverError;

const collectionToGuids: Record<string, string[]> = {};
const modelToGuid: Record<string, string> = {};

export const getModelDefinitionGuid = (name: string, collection = DEFAULT_COLLECTION) => modelToGuid[`${collection}@${name}`];
export const getModelGuidByEmid = (emid: string) => modelToGuid[emid];
export const getModelDefinitionsByCollection = (collection = DEFAULT_COLLECTION) => collectionToGuids[collection] ?? [];


const _mytype = (v: any) => v === null ? 'null' : typeof v;

const listsHaveDiffs = (list1: any[], list2: any[]) => {
    return new Set(list1).difference(new Set(list2)).size > 0;
}

/**
 * Applies @Property validation to specifications.
 */
export const standardPropertyValidation =  (value: any, propertyName: string, propMeta: Partial<PropertyMetadata>, emid: string) => {
    const { isRequired, isTypeOf, isArray, fixedValues } = propMeta;
    let errors: string[] = [];
    const errProperties: Record<string, string> = {};

    const _valType = _mytype(value);

    // case: assert isRequired (!undefined && !null)
    if (isRequired && (value === undefined || value === null)) {
        errors.push(`property-required (actual: ${_valType})`)
    }

    if (value !== undefined && value !== null) {
        // case: assert isArray on value
        if (isArray && !Array.isArray(value)) {
            errors.push(`property-array (actual: ${_valType})`);
        } else if (!isArray && Array.isArray(value)) {
            errors.push(`property-not-array (actual: array; set \`isArray\`)`);
        } else if (fixedValues) {
            const vals = value instanceof Array ? value : [value];
            if (listsHaveDiffs(vals, Object.keys(fixedValues))) {
                errors.push(`property-fixedValues (see \`properties.${propertyName}\`)`);
                errProperties[propertyName] = Object.keys(fixedValues).join('; ');
            }
        }
    }

    const _isTypeOf = typeof isTypeOf === 'string' ? [isTypeOf] : isTypeOf;
    if (_isTypeOf && _isTypeOf.length > 0 && !_isTypeOf.includes('*')) {
        let valTypes = [_valType];
        if (isArray && value.length) {
            valTypes = value.map(_mytype);
        }
    
        if (listsHaveDiffs(valTypes, _isTypeOf)) {
            errors.push(`property-typeOf-[${_isTypeOf.join(', ')}] (actual: [${valTypes.join(', ')}])`);
        }
    }

    if (errors.length > 0) {
        return new PropertyValidationError({property: propertyName, message: errors.join('; '), contextName: emid});
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

        const idKey = meta.idKey ?? 'id';

        const allDecs = getClassDecoratorMap(guid);
        const allProps = (allDecs.properties[EntityDecorators.Property] ?? {}) as Record<string, PropertyMetadata>;
        const proxy: Record<string, any> = { ...target };
        delete proxy.prototype;

        makeValidatingPropertyAccessors(
            target.prototype, 
            key, 
            allProps,
            proxy
        )
        
        const validatorInstMethod = Object.keys(allDecs.methods?.[EntityDecorators.Validator] ?? {})[0];
        const validatorStaticMethod = Object.keys(allDecs.methodsStatic?.[EntityDecorators.Validator] ?? {})[0];

        Object.defineProperties(target.prototype, {
            $id: {
                get() { return (proxy as any)[idKey]; }
            },
            $emid: {
                get() { return key; }
            },
            $assertValidEntity: {
                writable: false,
                value() {
                    let error: any;
                    if (validatorInstMethod && this[validatorInstMethod]) {
                        error = this[validatorInstMethod]();
                    } else if (validatorStaticMethod && this.constructor[validatorStaticMethod]) {
                        error = this.constructor[validatorStaticMethod](proxy);
                    }
                    error = error ?? standardEntityValidation(key, allProps, proxy);
                    if (error) throw error;
                }
            },
        });

        return target;
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
    validate: (value: any, property: string) => undefined | PropertyValidationError;
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

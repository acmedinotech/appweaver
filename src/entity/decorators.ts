import { getClassDecoratorMap, getGuid, registerClassDecorator, registerMethodDecorator, registerPropertyDecorator } from "../decorator-registry";
import { makeValidatingPropertyAccessors, standardEntityValidation } from "./core";
import { DEFAULT_COLLECTION, EntityDecorators, type ModelMetadata, type PropertyMetadata } from "./types";

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
        const meta = { collection: DEFAULT_COLLECTION, ...metadata };
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

/**
 * METHOD DECORATOR: Use on an instance or static method. Function must conform to {@see EntityValidatorFn} signature.
 */
export const Validator = () => {
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
        registerPropertyDecorator(EntityDecorators.Property, target, propertyKey, { name: propertyKey, ...metadata });
    };
};
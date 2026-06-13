import { getClassDecoratorMap, getGuid, registerClassDecorator, registerMethodDecorator, registerPropertyDecorator, type ClassConstructor } from "../decorator-registry";
import { makeStandardEntityAccessors } from "./core";
import { DEFAULT_COLLECTION, EntityDecorators, type ModelMetadata, type PropertyMetadata } from "./types";

const collectionToGuids: Record<string, string[]> = {};
const modelToGuid: Record<string, string> = {};

export const getModelDefinitionGuid = (name: string, collection = DEFAULT_COLLECTION) => modelToGuid[`${collection}@${name}`];
export const getModelGuidByEmid = (emid: string) => modelToGuid[emid];
export const getModelDefinitionsByCollection = (collection = DEFAULT_COLLECTION) => collectionToGuids[collection] ?? [];

/**
 * CLASS DECORATOR: Defines an entity @Model and injects StandardEntity into class prototype.
 * @param metadata 
 * @returns 
 */
export const Model = (metadata: ModelMetadata) => {
    return <T extends ClassConstructor<any>>(target: T) => {
        const meta = { collection: DEFAULT_COLLECTION, ...metadata };
        const { clazz, setEffectiveClass } = registerClassDecorator(EntityDecorators.Model, target, meta);

        const emid = `${meta.collection}@${meta.name}`;
        if (!collectionToGuids[meta.collection]) {
            collectionToGuids[meta.collection] = [];
        }

        const guid = getGuid(target);
        collectionToGuids[meta.collection].push(guid);
        modelToGuid[emid] = guid;

        const allDecs = getClassDecoratorMap(guid);
        const proxy: Record<string, any> = { ...(target as any) };
        delete proxy.prototype;

        const errorState: Record<string, any> = {};

        const newClass = makeStandardEntityAccessors(target, emid, allDecs);
        setEffectiveClass(newClass);
        return newClass as T;
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
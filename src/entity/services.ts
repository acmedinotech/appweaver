import { getClassForGuid, getGuid, getInheritedClassDecoratorMap } from "../decorator-registry";
import { makeModelDefinition } from "./core";
import { getModelGuidByEmid } from "./decorators";
import { EntityDecorators, type ModelDefinition, type ObservableEntity, type PropertyObserverFn } from "./types";

const modelDefCache: Record<string, ModelDefinition> = {};

/**
 * Gets/creates a static ModelDefinition object from inherited @Model classes.
 * @param clazz 
 * @returns 
 */
export const getModelDefinition = (clazz: any) => {
    const guid = getGuid(clazz);
    const cacheKey = guid;

    if (modelDefCache[cacheKey]) return modelDefCache[cacheKey];

    const allDecs = getInheritedClassDecoratorMap(clazz, [EntityDecorators.Model, EntityDecorators.Property, EntityDecorators.Validator]);
    if (!allDecs) return;

    modelDefCache[cacheKey] = makeModelDefinition(allDecs);
    return modelDefCache[cacheKey];
}

export const getModelDefinitionByGuid = (guid: string) => {
    const clazz = getClassForGuid(guid);
    if (!clazz) return undefined;
    return getModelDefinition(clazz);
}

export const getModelDefinitionByEmid = (emid: string) =>
    getModelDefinitionByGuid(getModelGuidByEmid(emid));
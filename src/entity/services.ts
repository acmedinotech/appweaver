import { getClassForGuid, getGuid, getInheritedClassDecoratorMap } from "../decorator-registry";
import { makeModelDefinition } from "./core";
import { getModelGuidByEmid } from "./decorators";
import { EntityDecorators, type ModelDefinition, type ObservableEntity, type PropertyObserverFn } from "./types";

export const makeObservableEntity = <Entity extends object>(modelDef: ModelDefinition, entity: Entity): Entity & ObservableEntity => {
    const observers: Record<string, PropertyObserverFn[]> = {};

    const notifyObservers = (key: string, value: any) => {
        [ ...(observers[key as string] ?? []), ...(observers['*'] ?? []) ].forEach(
            (observer, idx) => {
                try {
                    observer({property: key, value});
                } catch (error) {
                    console.error('🟠 observableEntity.error.observer', { error, observer, observerIndex: idx, key, value });
                    observer({property: key, value, error});
                }
            }
        );
    }

    const proxy = new Proxy(entity, {
        set: (target, prop, value) => {
            const key = prop as string;
            target[key as keyof typeof target] = value;

            if (modelDef.properties[key]) {
                notifyObservers(key, value);
            }

            return true;
        }
    }) as typeof entity & ObservableEntity;

    proxy.$observeWith = (observer, onProperties) => {
        const keys = (onProperties === '*' || onProperties === undefined) ? ['*'] : (Array.isArray(onProperties) ? onProperties : [onProperties]);
        for (const key of keys) {
            if (!observers[key]) observers[key] = [];
            observers[key].push(observer);
        }

        return () => {
            for (const key of keys) {
                observers[key] = observers[key].filter(o => o !== observer);
            }
        };
    }

    return proxy;
}

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
import { randomUUID } from "node:crypto";
import { getModelDefinitionByEmid } from "./services";
import { type DehydrateOptions, type EntityLifecycleManager, type IdExtractorFn, type ModelDefinition, type PropertyMetadata } from "./types";

export const passthruDecode = (value: any) => value;
export const passthruEncode = (value: any) => value;

export const prepareData = ({ mode, userData, appData: injectData = {} }: Parameters<EntityLifecycleManager['prepareData']>[0], modelDef: ModelDefinition) => {
    const result: ReturnType<EntityLifecycleManager['prepareData']> = {
        data: {},
        removed: {},
    }

    const { modelMetadata: { preserveKeys = [], ignoreKeys = []} } = modelDef;

    for (const key of preserveKeys) {
        if (userData[key] !== undefined) {
            result.data[key] = userData[key];
        }
    }

    const isCreate = mode === 'create';
    const isUpdate = !isCreate;

    for (const [propertyKey, meta] of Object.entries(modelDef.properties)) {
        const isReadOnly = meta.isReadOnly || meta.isAutoCreated || meta.isAutoUpdated;
        if (meta.isAutoCreated) {
            // case: always remove; only auto-add back on-create
            if (userData[propertyKey] !== undefined) {
                result.removed[propertyKey] = userData[propertyKey];
            }
            if (isCreate && meta.autoCreatedValue) {
                result.data[propertyKey] = meta.autoCreatedValue(propertyKey, modelDef);
            }
        } else if (meta.isAutoUpdated) {
            // case: always remove; only auto-add back on-update
            if (userData[propertyKey] !== undefined) {
                result.removed[propertyKey] = userData[propertyKey];
            }
            if (isUpdate && meta.autoUpdatedValue) {
                result.data[propertyKey] = meta.autoUpdatedValue(propertyKey, modelDef);
            }
        } else if (isUpdate && isReadOnly) {
            // case: always remove on-update
            if (userData[propertyKey] !== undefined) {
                result.removed[propertyKey] = userData[propertyKey];
            }
        } else {
            // @todo check if relationship
            result.data[propertyKey] = userData[propertyKey];
        }
    }

    // inject system key-value overrides
    Object.assign(result.data, injectData);

    for (const key of ignoreKeys) {
        if (result.data[key] === undefined) continue;
        result.removed[key] = result.data[key];
        delete result.data[key];
    }

    return result;
}

export const PROP_REL_ENCODING = '_rel_encType';
export const PROP_REL_EMID = '_rel_emid';
export const UUID_DEFAULT_PREFIX = '*';
export const VALUE_UNDEFINED_PREFIX = '*undefined:';

export const hydrateEntity = ({ entity: _entity, data, options = {} }: Parameters<EntityLifecycleManager['hydrateEntity']>[0], modelDef?: ModelDefinition) => {
    if (!modelDef) return undefined;
    const entity = _entity ?? (modelDef.createInstance());

    Object.entries(modelDef.properties).forEach(([propName, propDef]) => {
        if (data[propName] === undefined) return;

        const value = data[propName];
        if (propDef.relationship) {
            const { relType, emid: emidDefault } = propDef.relationship;
            if (value instanceof Array) {
                entity[propName] = value.map((subent) => 
                    hydrateEntity(
                        {data: subent, options},
                        getModelDefinitionByEmid(subent[PROP_REL_EMID] ?? emidDefault)
                    ) ?? subent
                ).forEach((subent, idx) => {
                    options.queueEntityFetch?.({entity: subent, parent: entity, key: propName, ord: idx});
                });

            } else {
                entity[propName] = hydrateEntity(
                    {data: value, options},
                    getModelDefinitionByEmid(value[PROP_REL_EMID])
                ) ?? value;
                options.queueEntityFetch?.({entity: entity[propName], parent: entity, key: propName});
            }
        } else {
            entity[propName] = propDef.decode(value, propName, modelDef);
        }
    })

    return entity;
}

const defaultIdExtractor: IdExtractorFn = (entity, keys) => {
    const extractedKeys: Record<string, any> = {};
    for (const key of keys) {
        if (entity[key] !== undefined)
            extractedKeys[key] = entity[key];
        else
            extractedKeys[key] = `${VALUE_UNDEFINED_PREFIX}${key}`;
    }
    return extractedKeys;
}

export const dehydrateProperty = (value: any, propDef: PropertyMetadata, _entity: any, { idExtractor = defaultIdExtractor }: DehydrateOptions = {}) => {
    let normValue = value;
    if (propDef.relationship && propDef.relationship) {
        const { emid: emidDefault, relType, emidConstraints: modelConstraints } = propDef.relationship;
        if (relType === 'embedded')
            return normValue; // @todo dehydrate embedded

        const {preservedProps: keys} = propDef.relationship;
        // @todo handle isArray
        const relEntity = value;
        if (typeof relEntity !== 'object')
            return null;

        // project keys + encType & emid/default
        const extractedKeys = idExtractor(relEntity, keys, propDef);
        const emid = relEntity[PROP_REL_EMID] ?? emidDefault;
        // @todo apply emidConstraints

        normValue = {
            ...extractedKeys,
            [PROP_REL_EMID]: emid,
            // @todo _rel_parent_id
        };
    }

    return normValue;
}

export class Dehydrator { }

/**
 * Produces 1+ documents containing:
 * 
 * - the root entity being dehydrated
 * - any property defined as `relationship=child` (recurse)
 */
export const dehydrateEntity= ({entity}: Parameters<EntityLifecycleManager['dehydrateEntity']>[0], modelDef?: ModelDefinition, options?: DehydrateOptions) => {
    const docs: Record<string, any>[] = [];

    const { depth: maxDepth = -1 } = (options ?? {});

    const recurseDehydrate = (ent: any, modelDef?: ModelDefinition, { depth = 0 }: DehydrateOptions = {}) => {
        if (!modelDef || (maxDepth >= 0 && depth >= maxDepth))
            return;

        const { id, _id, [PROP_REL_EMID]: emid, ...rest } = ent;
        const doc: Record<string, any> = { id, _id, [PROP_REL_EMID]: emid };
        docs.push(doc);

        for (const [propName, propDef] of Object.entries(modelDef.properties)) {
            const value = dehydrateProperty(ent[propName], propDef, ent, options);
            doc[propName] = value;
            if (propDef.relationship?.relType === 'child' && value) {
                recurseDehydrate(
                    value,
                    getModelDefinitionByEmid(value[PROP_REL_EMID]),
                    { depth: depth + 1 }
                );
            }
        }
    }

    recurseDehydrate(entity, modelDef);
    return docs;
}

export const makeEntityLifecycleManager = (emid: string): EntityLifecycleManager => {
    const modelDef = getModelDefinitionByEmid(emid);
    if (!modelDef) throw new Error(`lifecycle-invalid-emid: ${emid}`);

    return {
        prepareData: (args) => prepareData(args, modelDef),
        hydrateEntity: (args) => hydrateEntity(args, modelDef),
        dehydrateEntity: (args) => dehydrateEntity(args, modelDef),
    }
}
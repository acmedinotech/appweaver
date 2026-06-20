import { randomUUID } from "node:crypto";
import { getModelDefinitionByEmid } from "./services";
import { isStandardEntity, type DehydrateOptions, type EntityLifecycleManager, type IdExtractorFn, type ModelDefinition, type PropertyMetadata } from "./types";

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
            const { emid: emidDefault } = propDef.relationship;
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

export const extractEmid = (entity: any) => entity.$emid ?? entity[PROP_REL_EMID];

export const extractPreservedKeys = (entity: any, keys: string[]) => {
    const nv: Record<string, any> = {};
    for (const key of keys) {
        nv[key] = entity[key] ?? null;
    }
    return nv;
}

/**
 * Produces 1+ documents containing:
 * 
 * - the root entity being dehydrated
 * - any property defined as `relationship=child` (recurse)
 */
export const dehydrateEntity= ({entity, options}: Parameters<EntityLifecycleManager['dehydrateEntity']>[0], modelDef?: ModelDefinition): any[] => {
    if (!modelDef) { return [];}
    
    const { preserveKeys } = options ?? {};
    const emid = extractEmid(entity);
    const doc: Record<string, any> = { [PROP_REL_EMID]: emid };
    const docs: any[] = [];

    for (const [propName, propDef] of Object.entries(modelDef.properties)) {
        const { relationship, isArray } = propDef;
        const value = entity[propName];
        if (relationship) {
            if (!value) continue;
            // @todo worry about entities that couldn't be dehydrated?
            const relEmid = relationship.emid;
            const relOptions = { ...options };
            const preserveKeys = relationship?.relType !== 'embedded' ? [...relationship.preservedProps, PROP_REL_EMID] : undefined;

            const encodeRelationship = (subent: any) => {
                const relModelDef = getModelDefinitionByEmid(extractEmid(subent) ?? relEmid);
                const newDocs = dehydrateEntity({entity: subent, options: relOptions}, relModelDef);
                docs.push(...newDocs);
                if (newDocs[0]) {
                    return preserveKeys ? extractPreservedKeys(newDocs[0], preserveKeys) : newDocs[0];
                } else {
                    return null;
                }
            }

            if (isArray) {
                doc[propName] = value.map(encodeRelationship);
            } else {
                doc[propName] = encodeRelationship(value);
            }
        } else {
            doc[propName] = propDef.encode(value, propName, modelDef);
        }
    }
    return [preserveKeys ? extractPreservedKeys(doc, preserveKeys) : doc, ...docs];
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
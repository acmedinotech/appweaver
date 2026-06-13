# Entity Lifecycle Specification

## Prepare Data

parameters:
- `userData`
- `appData`
- `modelDef`
- `mode`: either 'create' or 'update'

algorithm:
- let data = (userData + appData) filtered by modelDef.preservedKeys
- for each modelDef.properties [key, metadata]
    - if modeIsCreate
        - if metadata.isAutoCreated
            - data[key] = metadata.autoCreatedValue?.() ?? appData[key]
        - else
            - data[key] = userData[key]
    - else
        - if metadata.isAutoUpdated
            - data[key] = metadata.autoUpdatedValue?.() ?? appData[key]
        - else
            - data[key] = userData[key]
    - if metadata.relationship as rel
        - get relModelDef by rel.emid
        - if relModelDef: data[key] = prepareData(userData[key], appData[key], relModelDef, mode)

## Hydration

parameters:
- `preparedData`
- `modelDef`

algorithm:
- get model instance
- apply data[key] = each preparedData[key] where key in @Model.preservedKeys
- for each modelDef.properties [key, metadata]
    - data[key] = preparedData[key]
    - if metadata.relationship as rel && rel.relType one-of [child, embedded]
        - get relModelDef by rel.emid
        - if relModelDef
            - data[key] = map hydrate(preparedData[key])
            - if options.queueEntityFetch
                - options.queueEntityFetch({ entity: data[key], parent: entity, key, ord? })
- @ queueEntityFetch: sends caller a partially hydrated entity (and its position within parent)
    - caller can now fetch all referenced entities and inject missing properties
    

## Dehydration

parameters:
- `entityData`
- `modelDef`

algorithm:
- accept model instance or object
- apply data[key] = entityData[key] where key in @Model.preservedKeys
- for each modelDef.properties [key, metadata]
    if metadata.relationship as rel:
        - partial = map data[key] on @Property.preservedProps
        - if rel.relType == 'child'
            - @@ dehydrate data[key] and store in doc list
    else:
        - ? apply isAutoCreated & isAutoUpdate
        - data[key] = @Model.finalEncode(@Property.encode(entityData[key]))
- apply delete data[key] where key in @Model.ignoredKeys
import { MongoClient, ObjectId, type Filter } from "mongodb";
import { Controller, Middleware } from "../../http/decorators";
import { smartContainer } from "../../library";
import type { EntityCollectionManagerInterface, GetManyResults } from "../../persist/decorators";
import { CollectionManagerLCRUDController as CollectionManagerAPIController } from "../../persist/services";
import { getMongodbConfigFromEnvVars, makeMongodbClientWrapper, type MongodbWrapper } from "./mongo";
import { getModelDefinitionGuid, hydrateAndValidateEntity, Model, Property, type HydrateOptions, type ModelDefinition } from "../../entity/decorators-types";
import { getModelDefinitionByGuid } from "../../entity/services";
import { getClassForGuid } from "../../decorator-registry";

import * as bundleExpressServer from './express';
import express, { type NextFunction } from 'express';
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import { AppWeaverError } from "../../constants";

export const bundleId = 'appweaver.sandbox.mern-stack';
export const idEntityManager = `${bundleId}.mongoEntityManager`;
export const collectionName = 'mern-stack.sandbox';
export const PROP_ENTITY_MODEL_ID = '_entityModelId';

export const PROP_SYS_MANAGED_KEYS = ['_entityModelId', '_ownerId'];

const {  Activate, Inject, Service } = smartContainer;

@Service({
    id: idEntityManager, bundleId, properties: {
        collection: collectionName,
    }
})
export class MongoEntityManager implements EntityCollectionManagerInterface {
    static readonly propEntityModelId = '_entityModelId';
    readonly mongo: MongodbWrapper;
    // we're associating the modelCollection with the persistent collection
    collectionName: string = '';

    constructor() {
        const config = getMongodbConfigFromEnvVars(process.env);
        this.mongo = makeMongodbClientWrapper(new MongoClient(config.uri as string), config);
    }

    @Activate()
    async activate(metadata: smartContainer.ServiceMetadata) {
        this.collectionName = metadata.properties?.collection ?? collectionName;
    }

    modelDefCache: Record<string, ModelDefinition> = {};

    getModelDefinition(modelName: string): ModelDefinition {
        const emid = `${this.collectionName}@${modelName}`;
        if (!this.modelDefCache[emid]) {
            // @ts-ignore
            this.modelDefCache[emid] = getModelDefinitionByGuid(getModelDefinitionGuid(modelName, this.collectionName));
        }
        return this.modelDefCache[emid];
    }

    makeModelInstance<EntityModel = any>(modelName: string, initialData?: Record<string, any>, options?: HydrateOptions): EntityModel {
        return this.getModelDefinition(modelName)?.hydrateEntity(
            { ...initialData ?? {}, [MongoEntityManager.propEntityModelId]: `${this.collectionName}@${modelName}` },
            options
        );
    }

    makeEntityPropsFor({ _id, modelName }: { _id?: any, modelName: string }, optionalData: Record<string, any> = {}): Record<string, any> {
        const map: Record<string, any> = {
            ...optionalData,
            [PROP_ENTITY_MODEL_ID]: `${this.collectionName}@${modelName}`,
        }
        if (_id) {
            map['_id'] = typeof _id === 'string' ? new ObjectId(_id) : _id;
        }
        return map;
    }

    async getOne<EntityModel = any>(modelName: string, _id: string, withFilter: any = {}): Promise<EntityModel> {
        return (
            await this.getMany(modelName,
                this.makeEntityPropsFor({ _id, modelName }, withFilter))
        )
            .items[0] as EntityModel;
    }

    async getMany<EntityModel = any, Filter = Record<string, any>>(modelName: string, filter: Filter): Promise<GetManyResults<EntityModel>> {
        const modelDef = this.getModelDefinition(modelName);
        const entities = await this.mongo.mapDocsFrom({
            collection: this.collectionName,
            withFilter: this.makeEntityPropsFor({ modelName }, filter ?? {}),
            afterFind: (cursor, docs) => {
                // console.log('🟢 getMany.afterFind // cursor', cursor, ' // ', docs);
            },
            mapTo: (doc) => modelDef.hydrateEntity(doc as Record<string, any>),
        })

        return { items: entities, modelName };
    }

    async create<EntityModel = any>(modelName: string, userData: any, withProps: Record<string, any> = {}): Promise<EntityModel> {
        const modelDef = this.getModelDefinition(modelName);
        const { data } = modelDef.prepareData('create', userData, {
            injectData: this.makeEntityPropsFor({ modelName }, withProps),
        })

        const entity = modelDef.hydrateEntity<EntityModel>(data);
        entity.$assertValidEntity();
        const result = await this.mongo.insertOne({
            collection: this.collectionName,
            record: data
        })

        return { ...entity, ...result };
    }

    async update<EntityModel = any>(modelName: string, userData: any, withConstraints: any = {}): Promise<EntityModel> {
        const modelDef = this.getModelDefinition(modelName);

        const canonical = await this.getOne(modelName, withConstraints._id, withConstraints);
        if (!canonical) {
            throw new AppWeaverError(`Could not find ${modelName} (#${withConstraints._id})`, 'mern-stack.mongo.update', {modelName, withConstraints});
        }

        const entity = modelDef.hydrateEntity<EntityModel>(canonical);
        const { data, removed } = modelDef.prepareData('update', userData, {
            removeKeys: PROP_SYS_MANAGED_KEYS,
        });

        Object.assign(entity, data);
        entity.$assertValidEntity();

        const { _id } = removed
        await this.mongo.updateOne({
            collection: this.collectionName,
            withFilter: this.makeEntityPropsFor({ _id, modelName }, withConstraints),
            record: data
        })

        return { _id, ...data } as EntityModel;
    }

    async delete(modelName: string, _id: string, withConstraints: any = {}): Promise<any> {
        const result = await this.mongo.deleteOne({
            collection: this.collectionName,
            withFilter: this.makeEntityPropsFor({ _id, modelName }, withConstraints),
        })
        return result;
    }
}

@Service({ id: `${bundleId}.mernStackController.api`, bundleId })
@Controller({ rootPath: '/api/sandbox/mern-stack/entities', isSubApp: true })
export class MernStackController extends CollectionManagerAPIController {
    @Inject(idEntityManager)
    entityManager: EntityCollectionManagerInterface = undefined as unknown as MongoEntityManager;
    parseJson = express.json();
    parseCookies = cookieParser();
    secretKeyAuthHack: string;

    constructor() {
        super();
        this.secretKeyAuthHack = randomUUID();
        console.log('⚠️ MernStackController: authHack secret key', this.secretKeyAuthHack);
    }

    getRequestUserData(request: any) {
        return (request as any).authHack ?? {};
    }

    @Middleware({ priority: 100, path: /.+/ })
    async doParseJson(request: express.Request, response: express.Response, next: NextFunction) {
        this.parseJson(request, response, (err?: any) => {
            next(err);
        });
    }

    @Middleware({ priority: 100, path: /.+/ })
    async doParseCookies(request: express.Request, response: express.Response, next: NextFunction) {
        this.parseCookies(request, response, (err?: any) => {
            next(err);
        });
    }

    @Middleware({ priority: 100, path: /.+/ })
    async doAuthHack(request: express.Request, response: express.Response, next: NextFunction) {
        if (request.headers['x-auth-hack'] === this.secretKeyAuthHack) {
            (request as any).authHack = {
                userId: 'auth-hack'
            }
        }

        next();
    }
}

@Model({ name: 'user', collection: collectionName })
class User {
    @Property({ isAutoCreated: true })
    readonly _id = undefined as any;
    @Property({ isRequired: true })
    readonly username = undefined as unknown as string;
    @Property({ isAutoCreated: true, autoCreatedValue: () => new Date() })
    readonly createdAt = undefined as unknown as Date;
    @Property({ isAutoUpdated: true, autoUpdatedValue: () => new Date() })
    readonly updatedAt = undefined as unknown as Date;
}

const container = new smartContainer.SmartContainer({
    bundleIds: {
        [bundleId]: true,
        [bundleExpressServer.bundleId]: true
    },
});

container.bootContainer().then(() => {
    console.log('🟢 container booted');
});
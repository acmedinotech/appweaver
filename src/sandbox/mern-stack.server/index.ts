import { MongoClient, ObjectId } from "mongodb";
import { Controller, Middleware } from "../../http/decorators";
import { Activate, Inject, Service, SmartContainer, type ServiceMetadata } from "../../library";
import type { EntityManagerInterface, GetManyResults } from "../../persist/decorators";
import { EntityManagerLCRUDController } from "../../persist/services";
import { getMongodbConfigFromEnvVars, makeMongodbClientWrapper, type MongodbWrapper } from "./mongo";
import { getModelDefinitionGuid, Model, Property, type ModelDefinition } from "../../entity/decorators";
import { getModelDefinitionByGuid } from "../../entity/services";
import { getClassForGuid } from "../../decorator-registry";

import * as bundleExpressServer from './express';
import express, { type NextFunction } from 'express';
import cookieParser from "cookie-parser";

export const bundleId = 'appweaver.sandbox.mern-stack';
export const idEntityManager = `${bundleId}.mongoEntityManager`;
export const collectionName = 'mern-stack.sandbox';

@Service({ id: idEntityManager, bundleId, properties: {
    collection: collectionName,
} })
export class MongoEntityManager implements EntityManagerInterface {
    static readonly propEntityModelId = '_entityModelId';
    readonly mongo: MongodbWrapper;
    // we're associating the modelCollection with the persistent collection
    collectionName: string = '';

    constructor() {
        const config = getMongodbConfigFromEnvVars(process.env);
        this.mongo = makeMongodbClientWrapper(new MongoClient(config.uri as string), config);
    }

    @Activate()
    async activate(metadata: ServiceMetadata) {
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
    
    makeModelInstance<EntityModel = any>(modelName: string, initialData?: Record<string, any>): EntityModel {
        const emid = `${this.collectionName}@${modelName}`;

        return this.getModelDefinition(modelName)?.hydrateEntity(
            {...initialData ?? {}, [MongoEntityManager.propEntityModelId]: emid }
        );
    }

    async getOne<EntityModel = any>(modelName: string, id: string): Promise<EntityModel> {
        const emid = `${this.collectionName}@${modelName}`;
        const entity =(await this.mongo.mapDocsFrom({
            collection: this.collectionName,
            withFilter: { _id: new ObjectId(id), [MongoEntityManager.propEntityModelId]: emid },
            mapFn: (doc) => this.makeModelInstance(modelName, doc as Record<string, any>),
        }))[0];

        if (!entity) throw new Error(`entity-not-found: ${modelName} @ id=${id}`);
        return entity;
    }

    async getMany<EntityModel = any, Filter = Record<string, any>>(modelName: string, filter: Filter): Promise<GetManyResults<EntityModel>> {
        const emid = `${this.collectionName}@${modelName}`;
        const modelDef = this.getModelDefinition(modelName);
        const entities = await this.mongo.mapDocsFrom({
            collection: this.collectionName,
            withFilter: {
                [MongoEntityManager.propEntityModelId]: emid,
                ...filter,
            },
            mapFn: (doc) => modelDef.hydrateEntity(doc as Record<string, any>),
        })
        return { items: entities, modelName };
    }

    async create<EntityModel = any>(modelName: string, entity: EntityModel): Promise<EntityModel> {
        throw new Error("create() not implemented.");
        // const emid = `${this.collectionName}@${modelName}`;
        // const collection = await this.mongo.getCollection(this.collectionName);
        // const doc = (entity as any);
        // await this.mongo.insertOneValidated({
        //     collection: this.collectionName,
        //     validated: hydrateModelFromData(this.makeModelInstance(modelName), entity),
        //     recordFn: (validated) => {
        //         validated[MongoEntityManager.propEntityModelId] = emid;
        //         return validated;
        //     },
        // })
        // doc[MongoEntityManager.propEntityModelId] = emid;
        // const result = await collection.insertOne(entity as any);
        // // console.log('🟢 MongoEntityManager: create // result', result);
        // doc._id = result.insertedId;
        // return doc;
    }

    async update<EntityModel = any>(modelName: string, entity: EntityModel): Promise<EntityModel> {
        // const emid = `${this.collectionName}@${modelName}`;
        // const doc = (entity as any);
        // doc[MongoEntityManager.propEntityModelId] = emid;
        // const collection = await this.mongo.getCollection(this.collectionName);
        // // @todo validate; hydrate
        // const result = await collection.updateOne({ _id: doc._id, [MongoEntityManager.propEntityModelId]: emid }, { $set: doc });
        // return entity;
        throw new Error("update() not implemented.");
    }

    async delete(modelName: string, id: string): Promise<any> {
        throw new Error("delete() not implemented.");
    }
}

@Service({ id: `${bundleId}.mernStackController.api`, bundleId })
@Controller({ rootPath: '/api/sandbox/mern-stack/entities', isSubApp: true })
export class MernStackController extends EntityManagerLCRUDController {
    @Inject(idEntityManager)
    entityManager: MongoEntityManager = undefined as unknown as MongoEntityManager;
    parseJson = express.json();
    parseCookies = cookieParser();

    @Middleware({ priority: 100, methods: ['POST', 'PUT', 'PATCH'], path: /.+/ })
    async doParseJson(request: express.Request, response: express.Response, next: NextFunction) {
        this.parseJson(request, response, (err?:any) => {
            console.log('🟢 MernStackController: parseJsonBody // ', err, request.body);
            next(err);
        });
    }

    @Middleware({ priority: 100, methods: ['*'], path: /.+/ })
    async doParseCookies(request: express.Request, response: express.Response, next: NextFunction) {
        this.parseCookies(request, response, (err?:any) => {
            console.log('🟢 MernStackController: parseCookies // ', err, request.cookies);
            next(err);
        });
    }
}

@Model({name: 'user', collection: collectionName})
class User {
    @Property({isReadOnly: true})
    _id = undefined as any;
    @Property({ isRequired: true })
    username = undefined as unknown as string;
}

const container = new SmartContainer({  
    bundleIds: { 
        [bundleId]: true,
        [bundleExpressServer.bundleId]: true
    },
});

container.bootContainer().then(() => {
    console.log('🟢 container booted');
});
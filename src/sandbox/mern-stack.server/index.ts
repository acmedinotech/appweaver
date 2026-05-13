import { MongoClient } from "mongodb";
import { Controller } from "../../http/decorators";
import { Activate, Inject, Service, SmartContainer, type ServiceMetadata } from "../../library";
import type { EntityManagerInterface, GetManyResults } from "../../persist/decorators";
import { EntityManagerLCRUDController } from "../../persist/services";
import { getMongodbConfigFromEnvVars, makeMongodbClientWrapper, type MongodbWrapper } from "./mongo";
import { getModelDefinitionGuid } from "../../entity/decorators";
import { getModelDefinitionByGuid, hydrateModelFromData } from "../../entity/services";
import { getClassForGuid } from "../../decorator-registry";

import * as bundleExpressServer from './express';

export const bundleId = 'appweaver.sandbox.mern-stack';
export const idEntityManager = `${bundleId}.mongoEntityManager`;
export const collectionName = 'mern-stack.sandbox';

@Service({ id: idEntityManager, bundleId, properties: {
    collection: collectionName,
} })
export class MongoEntityManager implements EntityManagerInterface {
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
    
    makeModelInstance<EntityModel = any>(modelName: string, initialData?: Record<string, any>): EntityModel {
        const guid = getModelDefinitionGuid(modelName, this.collectionName);
        const clazz = getClassForGuid(guid);
        const entity = new clazz();
        hydrateModelFromData(entity, initialData);
        return entity;
    }

    async getOne<EntityModel = any>(modelName: string, id: string): Promise<EntityModel> {
        let entity = this.makeModelInstance(modelName);
        const doc = (await this.mongo.getCollection(this.collectionName)).findOne({ _id: id });
        if (!doc) throw new Error(`entity-not-found: ${modelName} @ id=${id}`);
        entity = hydrateModelFromData(entity, doc);
        // @todo check if undefined?
        return entity;
    }

    async getMany<EntityModel = any, Filter = Record<string, any>>(modelName: string, filter: Filter): Promise<GetManyResults<EntityModel>> {
        const cursor = (await this.mongo.getCollection(this.collectionName)).find(filter);
        const docs = await cursor.toArray();
        const entities = docs.map(doc => hydrateModelFromData(this.makeModelInstance(modelName), doc));
        return { items: entities, modelName };
    }

    async create<EntityModel = any>(entity: EntityModel): Promise<EntityModel> {
        throw new Error("Method not implemented.");
    }

    async update<EntityModel = any>(entity: EntityModel): Promise<EntityModel> {
        throw new Error("Method not implemented.");
    }

    async delete(modelName: string, id: string): Promise<any> {
        throw new Error("Method not implemented.");
    }
}

@Service({ id: `${bundleId}.mernStackController.api`, bundleId })
@Controller({ rootPath: '/api/sandbox/mern-stack/entities', isSubApp: true })
export class MernStackController extends EntityManagerLCRUDController {
    @Inject(idEntityManager)
    entityManager: MongoEntityManager = undefined as unknown as MongoEntityManager;
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
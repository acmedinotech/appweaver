import { registerClassDecorator } from "../decorator-registry";
import { DEFAULT_COLLECTION } from "../entity";

export enum PersistInterfaces {
    EntityCollectionManager = 'persist.EntityCollectionManager',
}

export type EntityCollectionManagerMetadata = {
    modelCollection: string;
};

export type GetManyResults<EntityModel = any> = {
    items: EntityModel[];
    modelName: string;
}

/**
 * Fetch and save entities to an underlying datastore. Utilizes **`entity`** decorators for validation and hydration.
 */
export interface EntityCollectionManagerInterface {
    makeModelInstance<EntityModel = any>(modelName: string, data?: Record<string, any>): EntityModel;
    getOne<EntityModel = any, Filter = any>(modelName: string, id: string, filter?: Filter): Promise<EntityModel>;
    getMany<EntityModel = any, Filter = Record<string, any>>(modelName: string, filter: Filter): Promise<GetManyResults<EntityModel>>;
    create<EntityModel = any>(modelName: string, entity: EntityModel, withProps?: Record<string, any>): Promise<EntityModel>;
    update<EntityModel = any, Filter = any>(modelName: string, entity: EntityModel, withProps?: Record<string, any>, filter?: Filter): Promise<EntityModel>;
    delete<Filter = any>(modelName: string, id: string, filter?: Filter): Promise<any>;
}

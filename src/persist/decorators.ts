import { registerClassDecorator } from "../decorator-registry";
import { DEFAULT_COLLECTION } from "../entity/decorators";

export enum PersistDecorators {
    EntityManager = 'EntityManager',
}

export type EntityManagerMetadata = {
    modelCollection?: string;
};

export const EntityManager = (meta: Partial<EntityManagerMetadata>) => {
    return (target: any) => {
        registerClassDecorator(PersistDecorators.EntityManager, target, { collection: DEFAULT_COLLECTION, ...meta });
    }
}

export type GetManyResults<EntityModel = any> = {
    items: EntityModel[];
    modelName: string;
}

/**
 * Fetch and save entities to an underlying datastore. Utilizes **`entity`** decorators for validation and hydration.
 */
export interface EntityManagerInterface {
    makeModelInstance<EntityModel = any>(modelName: string, initialData?: Record<string, any>): EntityModel;
    getOne<EntityModel = any>(modelName: string, id: string): Promise<EntityModel>;
    getMany<EntityModel = any, Filter = Record<string, any>>(modelName: string, filter: Filter): Promise<GetManyResults<EntityModel>>;
    create<EntityModel = any>(entity: EntityModel): Promise<EntityModel>;
    update<EntityModel = any>(entity: EntityModel): Promise<EntityModel>;
    delete(modelName: string, id: string): Promise<any>;
}

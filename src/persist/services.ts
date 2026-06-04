import type { Request } from "express";
import { Controller, Middleware, Route } from "../http/decorators";
import * as smartContainer from "../smart-container";
import { PersistInterfaces, type EntityCollectionManagerInterface, type GetManyResults } from "./decorators";
import { getModelDefinition } from "../entity/services";
import { HttpError } from "../http/services";
import { EntityValidationError } from "../entity/decorators-types-core";
import { AppWeaverError } from "../constants";

@Controller({ rootPath: '/_dangerous_override', isSubApp: true })
@smartContainer.Service({ id: 'persist.CollectionManagerLCRUDController.abstract', 
    interfaces: [PersistInterfaces.EntityCollectionManager],
 })
export class CollectionManagerLCRUDController {
    @smartContainer.Inject('todo-entityManager-reference')
    entityManager: EntityCollectionManagerInterface = undefined as unknown as EntityCollectionManagerInterface;

    getRequestUserData(request: any) {
        return {} as Record<string, any>;
    }

    @Route({ path: '/:modelName/{:id}', methods: ['GET'] })
    async doGetOne(request: any, response: any) {
        const { modelName, id } = request.params;
        const _ownerId = this.getRequestUserData(request).userId ?? 'anonymous';
        try {
            return response.json(await this.entityManager.getOne(modelName as string, id, { _ownerId }));
        } catch (error) {
            return response.status(500).json({ error, modelName, id });
        }
    }

    @Route({ path: '/:modelName', methods: ['GET'] })
    async doGetMany(request: Request, response: any) {
        const { modelName } = request.params;
        const _ownerId = this.getRequestUserData(request).userId ?? 'anonymous';
        try {
            return response.json(await this.entityManager.getMany(modelName as string, {...request.query as Record<string, any>, _ownerId}));
        } catch (error) {
            return response.status(500).json({ error, modelName });
        }
    }

    @Route({ path: '/:modelName', methods: ['POST'], priority: 50 })
    async doCreate(request: any, response: any) {
        const { modelName } = request.params;
        const _ownerId = this.getRequestUserData(request).userId ?? 'anonymous';
        try {
            return response.json(await this.entityManager.create(modelName, request.body, { _ownerId }));
        } catch (error) {
            return CollectionManagerLCRUDController.returnErrorResponse(error, request, response, modelName);
        }
    }

    @Route({ path: '/:modelName/:id', methods: ['PUT'] })
    async doUpdate(request: any, response: any) {
        const { modelName, id: _id } = request.params;
        const _ownerId = this.getRequestUserData(request).userId ?? 'anonymous';
        try {
            const data = request.body;
            // @todo inject filter from request query
            const entity = await this.entityManager.getOne(modelName, _id, { _ownerId });
            if (!entity) { throw HttpError.notFound('entity-not-found', { path: request.path, modelName, id: _id }); }
            
            return response.json(await this.entityManager.update(modelName, {...data, _id}, {_id}));
        } catch (error) {
            return CollectionManagerLCRUDController.returnErrorResponse(error, request, response, modelName, _id);
        }
    }

    @Route({ path: '/:modelName/{:id}', methods: ['DELETE'] })
    async doDeleteOne(request: any, response: any) {
        const { modelName, id } = request.params;
        const _ownerId = this.getRequestUserData(request).userId ?? 'anonymous';
        try {
            const result = await this.entityManager.delete(modelName, id, { _ownerId });
            if (result.deletedCount === 0) { throw HttpError.notFound('entity-not-found', { path: request.path, modelName, id }); }
            return response.json(result);
        } catch (error) {
            return response.status(500).json({ error, modelName, id });
        }
    }

    static returnErrorResponse(error: any, request: any, response: any, modelName: string, id?: string) {
        if (error instanceof AppWeaverError) {
            const payload = error.toJson();
            const statusCode = payload.properties?.['statusCode'] ?? (error instanceof EntityValidationError ? 400 : 500);
            return response.status(statusCode).json({ error: payload });
        }
        console.error('🚨 unhandled-error', request.method, request.path, error);
        return response.status(500).json({ error: {
            message: `unhandled-error: ${error?.message}`,
            path: request.path, 
            modelName,
            id,
        }} );
    }
}
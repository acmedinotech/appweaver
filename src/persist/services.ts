import type { Request } from "express";
import { Controller, Middleware, Route } from "../http/decorators";
import { Inject, Service } from "../library";
import type { EntityManagerInterface, GetManyResults } from "./decorators";
import { getModelDefinition } from "../entity/services";
import { HttpError } from "../http/services";
import { EntityValidationError } from "../entity/decorators";
import { AppWeaverError } from "../constants";

@Controller({ rootPath: '/_dangerous_override', isSubApp: true })
@Service({ id: 'entityManagerLCRUDController.abstract' })
export class EntityManagerLCRUDController {
    @Inject('todo-entityManager-reference')
    entityManager: EntityManagerInterface = undefined as unknown as EntityManagerInterface;

    // @todo: add middleware for authentication/authorization
    // @todo: add request hook e.g. normalizeEntity(modelName, entity, request): typeof entity

    @Route({ path: '/:modelName/{:id}', methods: ['GET'] })
    async doGetOne(request: any, response: any) {
        const { modelName, id } = request.params;
        console.log('doGetOne', {modelName, id, query: request.query });
        try {
            return response.json(await this.entityManager.getOne(modelName as string, id));
        } catch (error) {
            return response.status(500).json({ error, modelName, id });
        }
    }

    @Route({ path: '/:modelName', methods: ['GET'] })
    async doGetMany(request: Request, response: any) {
        const { modelName } = request.params;
        console.log('doGetMany', {modelName, query: request.query });
        try {
            return response.json(await this.entityManager.getMany(modelName as string, request.query as Record<string, any>));
        } catch (error) {
            return response.status(500).json({ error, modelName });
        }
    }

    @Route({ path: '/:modelName', methods: ['POST'], priority: 50 })
    async doCreate(request: any, response: any) {
        const { modelName } = request.params;
        console.log('doCreate', {modelName, query: request.query, body: request.body });
        try {
            return response.json(await this.entityManager.create(modelName, request.body));
        } catch (error) {
            return EntityManagerLCRUDController.returnErrorResponse(error, request, response, modelName);
        }
    }

    @Route({ path: '/:modelName/:id', methods: ['PUT'] })
    async doUpdate(request: any, response: any) {
        const { modelName, id: _id } = request.params;
        try {
            const data = request.body;
            // @todo inject filter from request query
            const entity = await this.entityManager.getOne(modelName, _id);
            if (!entity) { throw HttpError.notFound('entity-not-found', { path: request.path, modelName, id: _id }); }
            
            return response.json(await this.entityManager.update(modelName, {...data, _id}, {_id}));
        } catch (error) {
            return EntityManagerLCRUDController.returnErrorResponse(error, request, response, modelName, _id);
        }
    }

    @Route({ path: '/:modelName/{:id}', methods: ['DELETE'] })
    async doDeleteOne(request: any, response: any) {
        const { modelName, id } = request.params;
        console.log('doDeleteOne', {modelName, id, query: request.query });
        try {
            const result = await this.entityManager.delete(modelName, id);
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
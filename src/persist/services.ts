import type { Request } from "express";
import { Controller, Route } from "../http/decorators";
import { Inject, Service } from "../library";
import type { EntityManagerInterface, GetManyResults } from "./decorators";
import { getModelDefinition } from "../entity/services";

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
        try {
            return response.json(await this.entityManager.getOne(modelName as string, id));
        } catch (error) {
            return response.status(500).json({ error, modelName, id });
        }
    }

    @Route({ path: '/:modelName', methods: ['GET'] })
    async doGetMany(request: Request, response: any) {
        const { modelName } = request.params;
        try {
            return response.json(await this.entityManager.getMany(modelName as string, request.query as Record<string, any>));
        } catch (error) {
            return response.status(500).json({ error, modelName });
        }
    }

    @Route({ path: '/:modelName', methods: ['POST'] })
    async doCreate(request: any, response: any) {
        const { modelName } = request.params;
        try {
            const entity = this.entityManager.makeModelInstance(modelName as string, request.body);
            return response.json(await this.entityManager.create(entity));
        } catch (error) {
            return response.status(500).json({ error, modelName });
        }
    }

    @Route({ path: '/:modelName/:id', methods: ['PUT'] })
    async doUpdate(request: any, response: any) {
        const { modelName, id } = request.params;
        try {
            const entity = this.entityManager.makeModelInstance(modelName as string, { id, ...request.body });
            const modelDef = getModelDefinition(entity);
            if (!modelDef) { throw new Error('invalid-model-definition')}
            const validationError = modelDef.validateEntity(entity);
            if (validationError) {
                throw validationError;
            }
            return response.json(await this.entityManager.update(entity));
        } catch (error) {
            return response.status(500).json({ error, modelName, id });
        }
    }

    @Route({ path: '/:modelName/:id', methods: ['DELETE'] })
    doDelete(request: any, response: any) {

    }
}
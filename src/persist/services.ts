import type { Request } from "express";
import { Controller, Route } from "../http/decorators";
import { Inject, Service } from "../library";
import type { EntityManagerInterface, GetManyResults } from "./decorators";

@Controller({ rootPath: '/_dangerous_override', isSubApp: true })
@Service({ id: 'entityManagerLCRUDController.abstract' })
export class EntityManagerLCRUDController {
    @Inject('todo-entityManager-reference')
    entityManager: EntityManagerInterface = undefined as unknown as EntityManagerInterface;

    // @todo: add middleware for authentication/authorization
    // @todo: add request hook e.g. normalizeEntity(modelName, entity, request): typeof entity

    @Route({ path: '/:modelName', methods: ['GET'] })
    async doGetMany(request: Request, response: any) {
        const { modelName } = request.params;
        return response.json(await this.entityManager.getMany(modelName as string, request.query as Record<string, any>));
    }
    
    @Route({ path: '/:modelName/{:id}', methods: ['GET'] })
    async doGetOne(request: any, response: any) {
        const { modelName, id } = request.params;
        return response.json(await this.entityManager.getOne(modelName as string, id));
    }

    @Route({ path: '/:modelName', methods: ['POST'] })
    async doCreate(request: any, response: any) {
        const { modelName } = request.params;
        const entity = this.entityManager.makeModelInstance(modelName as string, request.body);
        return response.json(await this.entityManager.create(entity));
    }

    @Route({ path: '/:modelName/:id', methods: ['PUT'] })
    async doUpdate(request: any, response: any) {
        const { modelName, id } = request.params;
        const entity = this.entityManager.makeModelInstance(modelName as string, {id, ...request.body});
    }

    @Route({ path: '/:modelName/:id', methods: ['DELETE'] })
    doDelete(request: any, response: any) {

    }
}
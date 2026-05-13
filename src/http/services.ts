import { getClassDecoratorMap, getGuid, getInheritedClassDecoratorMap } from "../decorator-registry";
import { addMetadataTransformer, type SmartContainer } from "../smart-container";
import { PostBoot, Service, SVC_PRIORITY_DEFAULT } from "../smart-container/decorators";
import type { MetadataTransformer, ServiceMetadata } from "../smart-container/types";
import { HttpDecorators, type ControllerMetadata, type RouteMetadata } from "./decorators";

export const httpServerMetadataTransformer: MetadataTransformer = (metadata: ServiceMetadata, serverMetadata): ServiceMetadata => {
    return {
        ...metadata,
        properties: {
            ...(metadata.properties ?? {}),
            [HttpDecorators.SERVER]: serverMetadata,
        }
    };
}

export const httpControllerMetadataTransformer: MetadataTransformer = (metadata: ServiceMetadata): ServiceMetadata => {
    return {
        ...metadata,
        interfaces: [...(metadata.interfaces ?? []), HttpDecorators.CONTROLLER],
    };
}

addMetadataTransformer(HttpDecorators.SERVER, httpServerMetadataTransformer);
addMetadataTransformer(HttpDecorators.CONTROLLER, httpControllerMetadataTransformer);

export type HttpRequestHandler<Req = Request, Res = Response, NextFn = (undefined | (() => void))> = (request: Req, response: Res, next: NextFn) => void;

export type ControllerAggregate = {
    controller: any;
    controllerMetadata: ControllerMetadata
    routes: {method: string, metadata: RouteMetadata}[];
    middleware: {method: string, metadata: RouteMetadata}[];
}

/**
 * Base class for all HTTP services. This collects the services for all active @Controller
 * instances, then collects the @Middleware & @Route methods in controller-priority order.
 */
export class BaseHttpService {
    @PostBoot()
    async postBoot(container: SmartContainer) {
        console.log('🟢 BaseHttpService: postBoot');
        BaseHttpService.gatherControllers(container);
    }

    mountServer(container: SmartContainer, aggregate: ControllerAggregate[]) {
        throw new Error('not-implemented');
    }

    /**
     * For every @Controller service, gather the @Route & @Middleware methods in priority order.
     * @param container 
     * @returns 
     */
    static gatherControllers(container: SmartContainer): ControllerAggregate[] {
        const controllers = container.findServices({
            interfaces: [HttpDecorators.CONTROLLER],
            cardinality: '0..n',
        }) as any[];
        return controllers.map((controller) => {
            const _allDecorators = getInheritedClassDecoratorMap(controller);
            const routes = [
                ...Object.entries(_allDecorators.methods[HttpDecorators.ROUTE] ?? {})] 
                .sort((a, b) => (b[1].priority??SVC_PRIORITY_DEFAULT) - (a[1].priority??SVC_PRIORITY_DEFAULT))
                .map((cur) => {
                    return {method: cur[0], metadata: cur[1]}
                });
            const middleware = [
                ...Object.entries(_allDecorators.methods[HttpDecorators.MIDDLEWARE] ?? {}), 
            ]
                .sort((a, b) => (b[1].priority??SVC_PRIORITY_DEFAULT) - (a[1].priority??SVC_PRIORITY_DEFAULT))
                .map((cur) => {
                    return {method: cur[0], metadata: cur[1]}
                });
            return {
                controller,
                controllerMetadata: _allDecorators.class[HttpDecorators.CONTROLLER],
                routes,
                middleware
            }
        });
    }
}
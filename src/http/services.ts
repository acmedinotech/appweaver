import { getDecoratedClassObject, getGuid } from "../decorator-registry";
import { addMetadataTransformer, type SmartContainer } from "../smart-container";
import { PostBoot, Service, SVC_PRIORITY_DEFAULT } from "../smart-container/decorators";
import type { MetadataTransformer, ServiceMetadata } from "../smart-container/types";
import { HttpDecorators } from "./decorators";


export const httpControllerMetadataTransformer: MetadataTransformer = (metadata: ServiceMetadata): ServiceMetadata => {
    return {
        ...metadata,
        interfaces: [...(metadata.interfaces ?? []), HttpDecorators.CONTROLLER],
    };
}

addMetadataTransformer( HttpDecorators.CONTROLLER, httpControllerMetadataTransformer);

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

    /**
     * For every @Controller service, gather the @Route & @Middleware methods in priority order.
     * @param container 
     * @returns 
     */
    static gatherControllers(container: SmartContainer) {
        const controllers = container.findServices({
            interfaces: [HttpDecorators.CONTROLLER],
            cardinality: '0..n',
        }) as any[];
        return controllers.map((controller) => {
            const _allDecorators = getDecoratedClassObject(getGuid(controller));
            const routes = [
                ..._allDecorators.decoratorToMethods[HttpDecorators.ROUTE] ?? [], 
            ]
                .sort((a, b) => (b[1].priority??SVC_PRIORITY_DEFAULT) - (a[1].priority??SVC_PRIORITY_DEFAULT))
                .map((cur) => {
                    return {method: cur[0], metadata: cur[1]}
                });
            const middleware = [
                ..._allDecorators.decoratorToMethods[HttpDecorators.MIDDLEWARE] ?? [], 
            ]
                .sort((a, b) => (b[1].priority??SVC_PRIORITY_DEFAULT) - (a[1].priority??SVC_PRIORITY_DEFAULT))
                .map((cur) => {
                    return {method: cur[0], metadata: cur[1]}
                });
            return {
                controller: _allDecorators.class[HttpDecorators.CONTROLLER],
                routes,
                middleware
            }
        });
    }
}
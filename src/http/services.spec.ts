import { getClassDecoratorMap, getGuid } from "../decorator-registry";
import { SmartContainer } from "../smart-container";
import { Service } from "../smart-container/decorators";
import { Controller, Middleware, Route } from "./decorators";
import { BaseHttpService } from "./services";

let bootCounter = 0;
const bundleId = 'http.services.test';
@Service({
    id: 'TestHttpService',
    priority: 100,
    bundleId
})
class TestHttpService extends BaseHttpService {
    async postBoot(container: SmartContainer) {
        bootCounter++;
        console.log('🟢 TestHttpService: postBoot');
        BaseHttpService.gatherControllers(container);
    }
}

@Controller({
    rootPath: '/test',
})
@Service({
    id: 'TestController',
    priority: 100,
    bundleId
})
class TestController {
    @Route({
        path: '/get',
        methods: ['GET'],
        priority: 60
    })
    getTest() {
    }

    @Route({
        methods: ['DELETE'],
        priority: 70
    })
    deleteTest() {
    }
}

@Controller({
    rootPath: '/test2',
})
@Service({
    id: 'TestController2',
    priority: 101,
    bundleId
})
class TestController2 {
    @Route({
        path: '/post',
        methods: ['POST'],
    })
    postTest() {
    }

    @Middleware({
        path: '/post',
        priority: 50,
    })
    middleware1() {
    }

    @Middleware({
        priority: 60,
    })
    middleware2() {
    }
}

describe('http/services: class BaseHttpService', () => {
    const container = new SmartContainer({
        bundleIds: { [bundleId]: true },
    });

    beforeAll(async () => {
        await container.bootContainer();
    });

    it('should invoke TestController.postBoot() and not base', () => {
        expect(bootCounter).toBe(1);
    });

    it('should find 2 controllers in priority order', () => {
        const collectedControllers = BaseHttpService.gatherControllers(container);
        expect(collectedControllers).toHaveLength(2);
        expect(collectedControllers[0].controllerMetadata.rootPath).toBe('/test2');
        expect(collectedControllers[1].controllerMetadata.rootPath).toBe('/test');
    });

    it('should sort routes in priority order', () => {
        const collectedControllers = BaseHttpService.gatherControllers(container);
        expect(collectedControllers[1].routes).toHaveLength(2);
        expect(collectedControllers[1].routes[0].method).toBe('deleteTest');
        expect(collectedControllers[1].routes[1].method).toBe('getTest');
        expect(collectedControllers[0].routes).toHaveLength(1);
        expect(collectedControllers[0].routes[0].method).toBe('postTest');
    });

    it('should sort middleware in priority order', () => {
        const collectedControllers = BaseHttpService.gatherControllers(container);
        expect(collectedControllers[0].middleware[0].method).toBe('middleware2');
        expect(collectedControllers[0].middleware[1].method).toBe('middleware1');
    });
});
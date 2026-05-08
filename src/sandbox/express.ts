import express from 'express';
import { Controller, HttpDecorators, Route, Server } from '../http/decorators';
import { BaseHttpService, type ControllerAggregate } from '../http/services';
import { SmartContainer } from '../smart-container';
import { Activate, Service } from '../smart-container/decorators';
import type { ServiceMetadata } from '../smart-container/types';

const debugRequestHandler: express.RequestHandler = (req, res) => {
    res.json({
        method: req.method,
        path: req.path,
        body: req.body,
        query: req.query,
        params: req.params,
        headers: req.headers,
        cookies: req.cookies,
        ip: req.ip,
        url: req.url,
        hostname: req.hostname,
        protocol: req.protocol,
        secure: req.secure,
        xhr: req.xhr
    })
}

@Service({
    id: 'express.server',
    bundleId: 'express'
})
@Server({
    port: 3001
})
export class ExpressServer extends BaseHttpService {
    private app: express.Application;
    private metadata: ServiceMetadata = {} as ServiceMetadata;

    constructor() {
        super();
        this.app = express();
    }

    @Activate()
    async activate(metadata: ServiceMetadata) {
        this.metadata = metadata;
    }

    subAppCache: Record<string, express.Application> = {};
    getAppForRootPath(rootPath: string, isSubApp?: boolean) {
        if (!rootPath || !isSubApp) return this.app;
        if (this.subAppCache[rootPath]) {
            console.log('🚀 ExpressServer: using subApp for', {rootPath});
            return this.subAppCache[rootPath]
        };

        console.log('🚀 ExpressServer: creating subApp for', {rootPath});
        const subApp = express();
        this.subAppCache[rootPath] = subApp;
        this.app.use(rootPath, subApp);
        return subApp;
    }

    mountServer(container: SmartContainer, controllers: ControllerAggregate[]) {
        controllers.forEach((controller) => {
            const service = controller.controller;
            const { rootPath = '', isSubApp } = controller.controllerMetadata;
            const app = this.getAppForRootPath(rootPath, isSubApp);

            [...controller.middleware, ...controller.routes].forEach((route) => {
                if (route.metadata.disabled) return;
                
                const { path = '/', paths = [], methods = ['GET'] } = route.metadata;
                // prefer paths if not empty
                const normPath = paths.length ? paths : path;
                const controllerMethod = route.method;

                console.log('🚀 ExpressServer: mounting', {controllerMethod, rootPath, paths: normPath, methods});

                if (methods.includes('*')) {
                    console.log('!');
                    app.all(normPath, (req, res, next) => {
                        console.log('🚀 ExpressServer: calling', controllerMethod, 'with', req.method, req.path);
                        service[controllerMethod](req, res, next);
                    });
                } else {
                    console.log('>');
                    methods.map(m => m.toLowerCase()).forEach((method) => {
                        app.use(normPath, (req, res, next) => {
                            service[controllerMethod](req, res, next);
                        });
                    })
                }
            });
        });
    }

    async postBoot(container: SmartContainer) {
        const controllers = BaseHttpService.gatherControllers(container);
        const port = this.metadata.properties?.[HttpDecorators.SERVER]?.port ?? 3000;
        this.mountServer(container, controllers);
        this.app.listen(port, () => {
            console.log(`🚀 ExpressServer: listening on port ${port}`);
        });
    }
}

@Controller({
    rootPath: '/sandbox/express',
    isSubApp: true,
})
@Service({
    id: 'SandboxController1',
    priority: 100,
    bundleId: 'express'
})
class SandboxController1 {
    @Route({
        path: '/',
        methods: ['*'],
    })
    doAll(req: express.Request, res: express.Response, next: express.NextFunction) {
        debugRequestHandler(req, res, next);
    }

    @Route({
        paths: ['/safe', '/safe/{*rest}'],
        methods: ['GET', 'OPTIONS', 'HEAD'],
    })
    doSafe(req: express.Request, res: express.Response, next: express.NextFunction) {
        debugRequestHandler(req, res, next);
    }
}
const container = new SmartContainer({
    bundleIds: { express: true },
});

container.bootContainer().then(() => {
    console.log('🟢 container booted');
});
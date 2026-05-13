import express from 'express';
import { Activate, PostBoot, Service, SmartContainer, type ServiceMetadata } from '../../library';
import { HttpDecorators, Server } from '../../http/decorators';
import { BaseHttpService, type ControllerAggregate } from '../../http/services';

export const bundleId = 'appweaver.sandbox.mern-stack.express';
export const idExpressServer = `express.server`;

export const debugRequestHandler: express.RequestHandler = (req, res) => {
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
    id: idExpressServer,
    bundleId
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

    @PostBoot()
    async postBoot(container: SmartContainer) {
        const controllers = BaseHttpService.gatherControllers(container);
        const port = this.metadata.properties?.[HttpDecorators.SERVER]?.port ?? 3000;
        this.mountServer(container, controllers);
        this.app.listen(port, () => {
            console.log(`🚀 ExpressServer: listening on port ${port}`);
        });
    }
}

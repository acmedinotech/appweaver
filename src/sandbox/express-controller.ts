import express from 'express';
import { Controller, Route } from '../http/decorators';
import { Service, SmartContainer } from '../library';
import { debugRequestHandler } from './mern-stack/express';

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
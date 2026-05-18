import { registerClassDecorator, registerMethodDecorator } from "../decorator-registry";

export const HttpDecorators = {
    SERVER: 'http.Server',
    CONTROLLER: 'http.Controller',
    MIDDLEWARE: 'http.Middleware',
    ROUTE: 'http.Route',
}

export const HTTP_SERVER_PORT = 510412
export type ServerMetadata = {
    port: number;
}

export const Server = (metadata: ServerMetadata = {port: HTTP_SERVER_PORT}) => {
    return (target: any) => {
        registerClassDecorator('http.Server', target, metadata);
    }
}

export type ControllerMetadata = {
    rootPath?: string;
    /** If true, creates/gets a sub-app for this controller at the given root path. */
    isSubApp?: boolean;
}

export const Controller = (metadata: ControllerMetadata = {
    rootPath: '/',
}) => {
    return (target: any) => {
        registerClassDecorator('http.Controller', target, metadata);
    }
}

export type MiddlewareMetadata = {
    path?: string | RegExp;
    paths?: (string | RegExp)[];
    priority?: number;
    disabled?: boolean;
}

export type RouteMetadata = MiddlewareMetadata & {
    methods?: string[];
}

export const Middleware = (metadata: MiddlewareMetadata) => {
    return (target: any, propertyKey: string | string, descriptor: PropertyDescriptor) => {
        registerMethodDecorator('http.Middleware', target, propertyKey as string, metadata);
    }
}

/** METHOD DECORATOR: @Route */
export const Route = (metadata: RouteMetadata) => {
    return (target: any, propertyKey: string | string, descriptor: PropertyDescriptor) => {
        registerMethodDecorator('http.Route', target, propertyKey as string, metadata);
    }
}

/** METHOD DECORATOR: @GET (alias to @Route) */
export const GET = (metadata: Exclude<RouteMetadata, 'methods'>) => Route({ ...metadata, methods: ['GET'] });
/** METHOD DECORATOR: @HEAD (alias to @Route) */
export const HEAD = (metadata: Exclude<RouteMetadata, 'methods'>) => Route({ ...metadata, methods: ['HEAD'] });
/** METHOD DECORATOR: @OPTIONS (alias to @Route) */
export const OPTIONS = (metadata: Exclude<RouteMetadata, 'methods'>) => Route({ ...metadata, methods: ['OPTIONS'] });
/** METHOD DECORATOR: @TRACE (alias to @Route) */
export const TRACE = (metadata: Exclude<RouteMetadata, 'methods'>) => Route({ ...metadata, methods: ['OPTIONS'] });
/** METHOD DECORATOR: @POST (alias to @Route) */
export const POST = (metadata: Exclude<RouteMetadata, 'methods'>) => Route({ ...metadata, methods: ['POST'] });
/** METHOD DECORATOR: @PUT (alias to @Route) */
export const PUT = (metadata: Exclude<RouteMetadata, 'methods'>) => Route({ ...metadata, methods: ['PUT'] });
/** METHOD DECORATOR: @PATCH (alias to @Route) */
export const PATCH = (metadata: Exclude<RouteMetadata, 'methods'>) => Route({ ...metadata, methods: ['PATCH'] });
/** METHOD DECORATOR: @DELETE (alias to @Route) */
export const DELETE = (metadata: Exclude<RouteMetadata, 'methods'>) => Route({ ...metadata, methods: ['DELETE'] });
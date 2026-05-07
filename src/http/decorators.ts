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

export type RouteMetadata = {
    path?: string | RegExp;
    paths?: (string | RegExp)[];
    priority?: number;
    methods?: string[];
    disabled?: boolean;
}

export const Middleware = (metadata: RouteMetadata) => {
    return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        registerMethodDecorator('http.Middleware', target, propertyKey as string, metadata);
    }
}

export const Route = (metadata: RouteMetadata) => {
    return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        registerMethodDecorator('http.Route', target, propertyKey as string, metadata);
    }
}
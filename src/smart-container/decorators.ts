import { registerClassDecorator, registerMethodDecorator, registerPropertyDecorator } from "../decorator-registry";
import { KEY_SVC_META, type ServiceFilter, type ServiceMetadata } from "./types";

export const SVC_PRIORITY_DEFAULT = 0;
export const SVC_LIFECYCLE_DEFAULT = 'container';



/**
 * CLASS DECORATOR: Defines the entrypoint for an application.
 * @param metadata 
 */
export const Application = (metadata: any) => {
}

/**
 * CLASS DECORATOR: Defines a service in the container.
 * @param metadata 
 * @returns 
 */
export const Service = (metadata: ServiceMetadata) => {
    return (target: any) => {
        registerClassDecorator('Service', target, metadata);
        target[KEY_SVC_META] = metadata;
        return target;
    }
}

export const getServiceMetadata = (target: any) => {
    return target[KEY_SVC_META];
}

/**
 * CLASS DECORATOR: Defines a bundle activator for the application.
 * @param metadata 
 * @returns 
 */
export const BundleActivator = (metadata: any) => {}

/**
 * PROPERTY & METHOD DECORATOR: Injects a service into a property or
 * via a setter method.
 * @param metadata 
 */
export const Inject = (filter: ServiceFilter) => {
    return (target: any, memberKey: string | symbol, descriptor?: PropertyDescriptor) => {
        if (descriptor) {
            registerMethodDecorator('Inject', target, memberKey as string, filter);
        } else {
            registerPropertyDecorator('Inject', target, memberKey as string, filter);
        }
        
    }
}

/**
 * METHOD DECORATOR: Defines the activate method for a service.
 * @param metadata 
 * @returns 
 */
export const Activate = (metadata: any = undefined) => {
    return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        registerMethodDecorator('Activate', target, propertyKey as string, metadata);
    }
}

/**
 * METHOD DECORATOR: Defines the deactivate method for a service.
 * @param metadata 
 * @returns 
 */
export const Deactivate = (metadata: any = undefined) => {
    return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
        registerMethodDecorator('Deactivate', target, propertyKey as string, metadata);
    }
}
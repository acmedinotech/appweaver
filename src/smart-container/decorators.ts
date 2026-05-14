import { registerClassDecorator, registerMethodDecorator, registerPropertyDecorator } from "../decorator-registry";
import { KEY_SVC_META, type ServiceFilter, type ServiceMetadata } from "./types";

export const SVC_PRIORITY_DEFAULT = 0;
export const SVC_LIFECYCLE_DEFAULT = 'container';

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

/**
 * Creates a @Service decorator set with `bundleId`. This is provided as a convenience
 * for when you have several services spread across multiple files. Example:
 * 
 * ```ts
 * // in a shared file
 * export const bundleId = `acmedinotech.dummyBundle`;
 * export const BundledService = makeBundleService(bundleId);
 * 
 * // in a service file
 * @BundledService({ ... })
 * export class AnyService {}
 * ```
 * @param bundleId 
 * @returns 
 */
export const makeBundledService = (bundleId: string) => 
    (metadata: ServiceMetadata) => Service({ ...metadata, bundleId })

export const getServiceMetadata = (target: any) => {
    return target[KEY_SVC_META];
}

/**
 * PROPERTY & METHOD DECORATOR: Injects a service into a property or
 * via a setter method.
 * @param metadata 
 */
export const Inject = (filter: ServiceFilter) => {
    return (target: any, memberKey: string | string, descriptor?: PropertyDescriptor) => {
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
    return (target: any, propertyKey: string | string, descriptor: PropertyDescriptor) => {
        registerMethodDecorator('Activate', target, propertyKey as string, metadata);
    }
}

export const PostBoot = (metadata: any = undefined) => {
    return (target: any, propertyKey: string | string, descriptor: PropertyDescriptor) => {
        registerMethodDecorator('PostBoot', target, propertyKey as string, metadata);
    }
}

/**
 * METHOD DECORATOR: Defines the deactivate method for a service.
 * @param metadata 
 * @returns 
 */
export const Deactivate = (metadata: any = undefined) => {
    return (target: any, propertyKey: string | string, descriptor: PropertyDescriptor) => {
        registerMethodDecorator('Deactivate', target, propertyKey as string, metadata);
    }
}
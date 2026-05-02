/**
 * Allows finding services and defining dependencies by either a serviceId string or a filter object.
 */
export type ServiceFilter = string | {
    cardinality: 'one' | 'many';
    ids?: string[];
    interfaces?: string | string[];
    priorityMin?: number;
    priorityMax?: number;
}

export const KEY_SVC_META = Symbol('svc.metadata');

export type ServiceMetadata = {
    id: string;
    interfaces?: string[];
    priority?: number;
    lifecycle?: 'singleton' | 'container' | 'transient';
    enabled?: boolean;
    runModes?: string[];
}

export type ServiceRecord = {
    service: any;
    metadata: ServiceMetadata;
}

export type ServiceTracker = {}
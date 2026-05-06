export const SC_ENV_PREFIX = '';

export enum SCEnvVars {
    RUN_MODES = 'RUN_MODES',
    BUNDLE_IDS = 'BUNDLE_IDS',
}

export enum EventBusTopics {
    CONTAINER_CONFIGURED = 'containerConfigured',
    SERVICE_BOOTED = 'serviceBooted',
    SERVICE_ERROR = 'serviceError',
}

export type ServiceFilterComplex = {
    /**
     * - `0..1`: 0 or 1 service (i.e. one-optional)
     * - `1..1`: 1 service (i.e. one-required)
     * - `0..n`: 0 or more services (i.e. many-optional)
     * - `1..n`: 1 or more services (i.e. many-required)
     */
    cardinality: '0..1' | '1..1'| '0..n' | '1..n';
    ids?: string[];
    interfaces?: string[];
    priorityMin?: number;
    priorityMax?: number;
}
/**
 * Allows finding services and defining dependencies by either a serviceId string or a filter object.
 */
export type ServiceFilter = string | ServiceFilterComplex

export const KEY_SVC_META = Symbol('svc.metadata');

export type ServiceMetadata = {
    id: string;
    bundleId?: string;
    interfaces?: string[];
    priority?: number;
    lifecycle?: 'singleton' | 'container' | 'transient';
    enabled?: boolean;
    runModes?: string[];
}

export type MetadataTransformer = (metadata: ServiceMetadata) => ServiceMetadata;

export type ServiceRecord = {
    service: any;
    metadata: ServiceMetadata;
}

export type ServiceTracker = {}
export type ServiceOptions = {
    lifecycle?: 'singleton' | 'container' | 'transient';
    interfaces?: string[];
    dependencies?: string[];
}

export type ServiceDefinition = {
    id: string;
} & ServiceOptions;

export type BundleDefinition = {
    bundleId: string;
    services: ServiceDefinition[];
}

export interface BundleLoader {
    onLoad(bundle: BundleDefinition, container: ServiceContainer): Promise<void>;
    onUnload(bundle: BundleDefinition, container: ServiceContainer): Promise<void>;
}

export interface ServiceContainer {
    register(serviceId: string, service: any, opts?: ServiceOptions): void;
    queueService(definition: ServiceDefinition): void;
    queueBundle(definition: BundleDefinition): void;
    bootQueue(): Promise<void>;
    get(serviceId: string, filter?: any): any;
    unloadBundle(bundleId: string): Promise<void>;
    listenForService(serviceId: string, listener: (service: any) => void): void;
    listenForBundle(bundleId: string, listener: (bundle: BundleDefinition) => void): void;
}
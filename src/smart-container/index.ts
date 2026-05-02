import { getClassesForDecorator } from "../decorator-registry";
import { normalizeServiceMetadata } from "./decorators";
import type { ServiceFilter, ServiceMetadata, ServiceRecord } from "./types.ts";

const _singletons: Record<string, ServiceRecord> = {};

export class SmartContainer {
    protected _services: Record<string, ServiceRecord> = {};
    
    register(id: string, service: any, _metadata: Partial<ServiceMetadata> = {}) {
        const metadata = normalizeServiceMetadata({id, ..._metadata});
        const ptr = metadata.lifecycle === 'singleton' ? _singletons : this._services;
        ptr[id] = {
            service,
            metadata
        }
    }

    getService<T>(id: string) {
        return (_singletons[id] ?? this._services[id]) as T;
    }

    findServices(filter: ServiceFilter) {
        if (typeof filter === 'string') {
            const svc = this._services[filter] ?? _singletons[filter];
            if (svc) { return [svc]; }
        }
        const found: any[] = [];
        // @todo: implement filter by interating over _services and comparing metadata to filter;
        return found;
    }

    // protected _queueServices: ServiceMetadata[] = [];

    // queueService(metadata: ServiceMetadata) {
    //     this._queueServices.push(metadata);
    // }

    // protected _queueBundles: Record<string, any> = {};

    // queueBundle(_metadata: any) {
    //     const metadata = {bundleId: new Date().toISOString(), ..._metadata};
    //     this._queueBundles[metadata.bundleId] = metadata;
    // }
    
    async bootContainer() {
        console.group('🟢 Booting container');
        const annotatedServices = getClassesForDecorator('Service');
        console.log(annotatedServices);
        console.groupEnd();
    } 
}
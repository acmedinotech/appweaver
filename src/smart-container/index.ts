import { getClassesForDecorator, getDecoratedClassObject, type ClassDecoratorRecord } from "../decorator-registry";
import { getServiceMetadata, normalizeServiceMetadata, SVC_PRIORITY_DEFAULT } from "./decorators";
import type { ServiceFilter, ServiceFilterComplex, ServiceMetadata, ServiceRecord } from "./types.ts";

export const asyncForEach = async (arr: any[], callback: (...args:any[]) => Promise<void>) => {
    for (const item of arr) {
        await callback(item);
    }
}

export type BootServiceDeferred = {
    metadata: ServiceMetadata;
    lastInjectorCount: number;
    injector: () => number;
    activator: () => Promise<void>;
}

const _singletons: Record<string, ServiceRecord> = {};

export const filterServiceComplex = ([id, svc]: [string, ServiceRecord], filter: ServiceFilterComplex) => {
    const { ids, interfaces, priorityMin, priorityMax } = filter;
    if (ids && !ids.includes(id)) { return false; }
    if (interfaces && !interfaces?.some((iface) => svc.metadata.interfaces?.includes(iface))) { return false; }
    if (priorityMin && (svc.metadata.priority??SVC_PRIORITY_DEFAULT) < priorityMin) { return false; }
    if (priorityMax && (svc.metadata.priority??SVC_PRIORITY_DEFAULT) > priorityMax) { return false; }
    return true;
}

/**
 * If filter is a string, return the service with the given id.
 * If filter is an object, return the services that match the filter (applying AND to each non-empty filter field)
 * @param services 
 * @param filter 
 * @returns 
 */
export const filterServices = (services: Record<string, ServiceRecord>, filter: ServiceFilter) => {
    if (typeof filter === 'string') {
        const svc = services[filter] ?? _singletons[filter];
        if (svc) { return [svc.service]; }
        return []
    }

    const {cardinality} = filter;
    const found: any[] = Object.entries(services)
        .filter((ele) => filterServiceComplex(ele, filter))
        .sort((a, b) => (a[1].metadata.priority??SVC_PRIORITY_DEFAULT) - (b[1].metadata.priority??SVC_PRIORITY_DEFAULT))
        .map((ele) => ele[1].service);
    
    switch (cardinality) {
        case '0..1':
            return found[0];
        case '0..n':
            return found;
        case '1..n':
            return found.length ? found : undefined;
        // '1..1' is the default
        default:
            return found.length ? found[0] : undefined;
    }
}

export type BootContainerOptions = {
    /** If defined, restricts services to the given bundle ids. */
    enabledBundleIds?: string[];
    runModes?: string[];
}

export type InjectDependency = [number, string, ServiceFilter];

export class SmartContainer {
    protected _services: Record<string, ServiceRecord> = {};
    
    register(id: string, service: any, _metadata: Partial<ServiceMetadata> = {}) {
        // @todo check if service is already registered
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
        return filterServices(this._services, filter);
    }

    protected liveServices: Record<string, {status: string; error: any}> = {}

    protected depCheckCycle = 0;
    protected dependencyGraph: Record<string, InjectDependency[]> = {};

    protected resolveDependencies(service: any, dependencies: InjectDependency[]): InjectDependency[] {
        const unresolvedDependencies: typeof dependencies = [];
        for (const [memberType, memberKey, filter] of dependencies) {
            // console.log('💜 resolveDependencies', memberType, memberKey, filter);
            const queryResults = this.findServices(filter);
            // console.log('>>> queryResults', queryResults);
            if (!queryResults) {
                unresolvedDependencies.push([memberType, memberKey, filter]);
            } else {
                if (memberType === 0) {
                    service[memberKey] = queryResults;
                } else {
                    service[memberKey](queryResults);
                }
            }
        }
        return unresolvedDependencies;
    }

    bootService([guid, cls, metadata]: ClassDecoratorRecord) {
        // @todo apply enabledBundleIds
        // @todo apply runModes
        // @todo apply enabled
        // @todo map interfaces to services
        
        // console.log('🟢 Annotated service', guid, cls,metadata);

        let status = 'defined';
        let error: any = null;

        // @todo work out semantics for singleton/container (might need a singletonLiveServices module var)
        if (this.getService(metadata.id)) {
            console.warn(`🟡 Service ${metadata.id} is already registered`);
            status = 'error';
            error = new Error(`Service ${metadata.id} is already registered`);
            this.liveServices[metadata.id] = {status, error};
            return {metadata, lastInjectorCount: 0, injector: () => 0, activator: async() => {}};
        }

        const service = new cls();

        // @todo detect dependencies
        const decoratedClassObject = getDecoratedClassObject(guid);

        status = 'pending';
        this.liveServices[metadata.id] = {status, error};

        const dependencies = [
            ...(decoratedClassObject.decoratorToProps.Inject ?? []).map(([memberKey, filter]) => [0, memberKey, filter] as InjectDependency),
            ...(decoratedClassObject.decoratorToMethods.Inject ?? []).map(([memberKey, filter]) => [1, memberKey, filter] as InjectDependency),
        ]
        this.dependencyGraph[metadata.id] = dependencies;

        const me = this;
        const injector = () => {
            // console.log('>>> injector', metadata.id);
            const unresolvedDependencies = this.resolveDependencies(service, me.dependencyGraph[metadata.id]);
            // console.log('>>> unresolvedDependencies', metadata.id,unresolvedDependencies);
            if (unresolvedDependencies.length === 0) {
                delete me.dependencyGraph[metadata.id];
                // console.log(`🟢 resolved ${metadata.id}`);
                return 0;
            } else {
                me.dependencyGraph[metadata.id] = unresolvedDependencies;
                // console.warn(`🟡 pending ${metadata.id}: ${unresolvedDependencies} dependencies`);
                return unresolvedDependencies.length;
            }
        }

        const activator = async () => {
            const activatorMethod = decoratedClassObject.decoratorToMethods.Activate?.[0]?.[0];
            // console.log('🟢 activatorMethod', activatorMethod);
            if (activatorMethod) {
                try {
                    await service[activatorMethod]();
                    status = 'active';
                } catch (err) {
                    console.error('🔴 Error activating service', metadata.id, err);
                    status = 'error';
                    error = err;
                }
            } else {
                status = 'active';
            }

            me.register(metadata.id, service);
            me.liveServices[metadata.id] = {status, error};
        }

        return {metadata, lastInjectorCount: -1, injector, activator};
    }

    async bootContainer({
        enabledBundleIds = [],
        runModes = [],
    }: BootContainerOptions = {}) {
        // @todo load env vars (runModes, enabledBundleIds)
        // @todo remove params.enabledBundleIds and params.runModes if prefixed with '!'
        console.group('🟢 Booting container');

        const pendingServices: BootServiceDeferred[] = [];
        const annotatedServices = getClassesForDecorator('Service');
        annotatedServices.forEach(async (decRec) => {
            const {injector, activator} = this.bootService(decRec);
            const lastInjectorCount = injector();
            if (lastInjectorCount == 0) {
                await activator();
            } else {
                pendingServices.push({metadata: decRec[2], lastInjectorCount, injector, activator});
            }
        });

        await this.resolvePendingServices(pendingServices);

        console.groupEnd();
    }

    async resolvePendingServices(pending: BootServiceDeferred[]) {
        // console.log('🔵 resolvePendingServices', pending);
        const newPending: typeof pending = [];
        for (const deferred of pending) {
            const id = deferred.metadata.id;
            // console.log('>>> deferred', id, deferred);
            const lastInjectorCount = deferred.injector();
            // console.log('🔵 resolvePendingServices', {lastInjectorCount});
            if (lastInjectorCount == 0) {
                await deferred.activator();
            } else if (deferred.lastInjectorCount != lastInjectorCount) {
                newPending.push({...deferred, lastInjectorCount});
            } else {
                console.warn(`🟡 Service ${id} cannot resolve: ${lastInjectorCount} dependencies`);
            }
        }

        // console.log('>>> hasPending', newPending.length);
        if (newPending.length > 0) {
            this.resolvePendingServices(newPending);
        }
    }
}
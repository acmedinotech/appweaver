import EventEmitter from "events";
import { getClassesForDecorator, getDecoratedClassObject, type ClassDecoratorRecord } from "../decorator-registry";
import { getServiceMetadata, normalizeServiceMetadata, SVC_PRIORITY_DEFAULT } from "./decorators";
import type { ServiceFilter, ServiceFilterComplex, ServiceMetadata, ServiceRecord } from "./types.ts";

export type BootServiceDeferred = {
    metadata: ServiceMetadata;
    lastInjectorCount: number;
    injector: () => number;
    activator: () => Promise<void>;
}

export enum EventBusTopics {
    SERVICE_BOOTED = 'serviceBooted',
    SERVICE_ERROR = 'serviceError',
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
        // console.log('>>> filterServices', {filter, svc, svcKeys: Object.keys(services)}, );
        return svc?.service;
    }

    const {cardinality} = filter;
    const found: any[] = Object.entries(services)
        .filter((ele) => filterServiceComplex(ele, filter))
        .sort((a, b) => (a[1].metadata.priority??SVC_PRIORITY_DEFAULT) - (b[1].metadata.priority??SVC_PRIORITY_DEFAULT))
        .map((ele) => ele[1].service);
    
    // console.log('>>> filterServices', Object.keys(services), {cardinality, filter, found});
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
        return (_singletons[id]?.service ?? this._services[id]?.service) as T;
    }

    findServices(filter: ServiceFilter) {
        return filterServices(this._services, filter);
    }

    protected liveServices: Record<string, {status: string; error: any}> = {}

    protected depCheckCycle = 0;
    protected dependencyGraph: Record<string, InjectDependency[]> = {};

    protected resolveDependencies(service: any, dependencies: InjectDependency[]): InjectDependency[] {
        // console.log('>>> resolveDependencies', service, dependencies);
        const unresolvedDependencies: typeof dependencies = [];
        for (const [memberType, memberKey, filter] of dependencies) {
            // console.log('💜 resolveDependencies', memberType, memberKey, filter);
            const queryResults = this.findServices(filter);
            // console.log('>>> queryResults', {memberType, memberKey, filter}, queryResults);
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

        // console.log('>>> dependencies', metadata.id, dependencies);

        const me = this;
        const injector = () => {
            const unresolvedDependencies = me.resolveDependencies(service, me.dependencyGraph[metadata.id]);
            if (unresolvedDependencies.length === 0) {
                delete me.dependencyGraph[metadata.id];
                return 0;
            } else {
                me.dependencyGraph[metadata.id] = unresolvedDependencies;
                return unresolvedDependencies.length;
            }
        }

        const activator = async () => {
            const activatorMethod = decoratedClassObject.decoratorToMethods.Activate?.[0]?.[0];
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
            console.log('ℹ️ bootService: ', status == 'active' ? '✅' : '⚠', metadata.id);
            me.liveServices[metadata.id] = {status, error};
            // @todo emit event 'serviceBooted'
        }

        return {metadata, lastInjectorCount: -1, injector, activator};
    }

    async bootContainer({
        enabledBundleIds = [],
        runModes = [],
    }: BootContainerOptions = {}) {
        // @todo load env vars (runModes, enabledBundleIds)
        // @todo remove params.enabledBundleIds and params.runModes if prefixed with '!'
        console.group('🟢 SmartContainer: start boot');

        const pendingServices: BootServiceDeferred[] = [];
        const annotatedServices = getClassesForDecorator('Service');
        for (const decRec of annotatedServices) {
            const {injector, activator} = this.bootService(decRec);
            const lastInjectorCount = injector();
            if (lastInjectorCount == 0) {
                await activator();
            } else {
                pendingServices.push({metadata: decRec[2], lastInjectorCount, injector, activator});
            }
        }

        await this.resolvePendingServices(pendingServices);

        console.group('🟢 SmartContainer: end boot');
        console.groupEnd();
    }

    async resolvePendingServices(pending: BootServiceDeferred[]) {
        const newPending: typeof pending = [];
        for (const deferred of pending) {
            const id = deferred.metadata.id;
            const lastInjectorCount = deferred.injector();
            if (lastInjectorCount == 0) {
                await deferred.activator();
            } else if (deferred.lastInjectorCount != lastInjectorCount) {
                newPending.push({...deferred, lastInjectorCount});
            } else {
                console.warn(`🟡 Service ${id} cannot resolve: ${lastInjectorCount} dependencies`);
            }
        }

        if (newPending.length > 0) {
            this.resolvePendingServices(newPending);
        }
    }

    protected eventBus = {
        container: new EventEmitter(),
        services: new EventEmitter(),
    }

    listenOn(bus: keyof typeof this.eventBus, topic: string, listener: (...args: any[]) => void) {
        this.eventBus[bus].on(topic, listener);
        return () => this.eventBus[bus].off(topic, listener);
    }
}
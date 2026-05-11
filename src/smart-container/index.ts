import { getClassesForDecorator, getDecoratedClassObject, type ClassDecoratorRecord, type DecoratedClassObject } from "../decorator-registry";
import { SVC_LIFECYCLE_DEFAULT, SVC_PRIORITY_DEFAULT } from "./decorators";
import { type MetadataTransformer, type ServiceFilter, type ServiceFilterComplex, type ServiceMetadata, type ServiceRecord } from "./types";
import { AWEnvVars } from "../constants";

export type BootServiceDeferred = {
    metadata: ServiceMetadata;
    lastInjectorCount: number;
    injector: () => number;
    activator: () => Promise<void>;
}

export const normalizeServiceMetadata = (metadata: Partial<ServiceMetadata> = {}): ServiceMetadata => {
    return {
        // @todo better default id
        id: metadata.id ?? new Date().toISOString(),
        interfaces: [],
        priority: SVC_PRIORITY_DEFAULT,
        lifecycle: SVC_LIFECYCLE_DEFAULT,
        enabled: true,
        bundleId: '*',
        runModes: ['default'],
        ...metadata,
    }
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
export const filterServices = (services: Record<string, ServiceRecord>, filter: ServiceFilter): any[]|any|undefined => {
    if (typeof filter === 'string') {
        const svc = services[filter] ?? _singletons[filter];
        return svc?.service;
    }

    const {cardinality} = filter;
    const found: any[] = Object.entries(services)
        .filter((ele) => filterServiceComplex(ele, filter))
        .sort((a, b) => (b[1].metadata.priority??SVC_PRIORITY_DEFAULT) - (a[1].metadata.priority??SVC_PRIORITY_DEFAULT))
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
    nodeEnv: string;
    /** If defined, restricts services to the given bundle ids. */
    bundleIds: Record<string, boolean>;
    runModes: Record<string, boolean>;
}

export type InjectDependency = [number, string, ServiceFilter];

export const parseRuleStringToMap = (ruleString?: string, initialMap: Record<string, boolean> = {}): Record<string, boolean> => {
    const rstring = (ruleString ?? '').trim();
    if (!rstring) {
        return initialMap;
    }

    const map: Record<string, boolean> = {...initialMap};
    const rules = rstring.split(/\s*,\s*/g);
    for (const rule of rules) {
        if (rule.startsWith('!')) {
            map[rule.slice(1)] = false;
        } else {
            map[rule] = true;
        }
    }
    return map;
}

export const getConfigFromEnv = (env: Record<string, string>): BootContainerOptions => {
    const config: BootContainerOptions = {
        runModes: parseRuleStringToMap(env[AWEnvVars.RUN_MODES], {[env['NODE_ENV'] ?? 'development']: true, default: true}),
        bundleIds: parseRuleStringToMap(env[AWEnvVars.BUNDLE_IDS] ?? ''),
        nodeEnv: env['NODE_ENV'] ?? 'development',
    }
    return config;
}

const _metadataTransformers: Record<string, MetadataTransformer> = {};

/**
 * Allows transformation of @Service metadata via other class decorators. For instance,
 * @Controller services will add `http.Controller` to the `interfaces` array.
 * @param decorator 
 * @param transformer 
 */
export const addMetadataTransformer = (decorator: string, transformer: MetadataTransformer) => {
    _metadataTransformers[decorator] = transformer;
}

export const applyMetadataTransformers = (_metadata: ServiceMetadata, decoratedClassObject: DecoratedClassObject) => {
    let metadata = {..._metadata};
    for (const decorator of Object.keys(decoratedClassObject.class)) {
        if (_metadataTransformers[decorator]) {
            metadata = _metadataTransformers[decorator](metadata, decoratedClassObject.class[decorator]);
        }
    }
    return metadata;
}

export class SmartContainer {
    protected _services: Record<string, ServiceRecord> = {};
    protected _config: BootContainerOptions;

    constructor({
        bundleIds = {},
        runModes = {},
    }: Partial<BootContainerOptions> = {}) {
        this._config = getConfigFromEnv(process.env as Record<string, string>);
        // bundleIds and runModes are guarded by any initial ENV_VAR values
        this._config.bundleIds = { ...bundleIds, ...this._config.bundleIds };
        this._config.runModes = { ...runModes, ...this._config.runModes };
    }

    public isRunModeEnabled(runMode: string|string[]) {
        const checkModes = Array.isArray(runMode) ? runMode : [runMode];
        for (const mode of checkModes) {
            if (this._config.runModes[mode]) {
                return true;
            }
        }
        return false;
    }

    public isBundleIdEnabled(bundleId?: string) {
        return this._config.bundleIds[bundleId??'*'] ?? this._config.bundleIds['*'] ?? false;
    }

    public isEnvDev() {
        return this._config.nodeEnv.startsWith('dev');
    }

    public isEnvTest() {
        return this._config.nodeEnv === 'test';
    }

    public isEnvProd() {
        return this._config.nodeEnv.startsWith('prod');
    }

    register(id: string, service: any, _metadata: Partial<ServiceMetadata> = {}) {
        if (this.getService(id)) {
            console.warn(`🟡 Service ${id} is already registered`);
            return false;
        }

        // @todo check if service is already registered
        const metadata = normalizeServiceMetadata({id, ..._metadata});
        const ptr = metadata.lifecycle === 'singleton' ? _singletons : this._services;
        ptr[id] = {
            service,
            metadata
        }
        return true;
    }

    /**
     * Attempts to get a service by id. Checks for singleton first, then container.
     */
    getService<T>(id: string) {
        return (_singletons[id]?.service ?? this._services[id]?.service) as T;
    }

    findServices(filter: ServiceFilter) {
        return filterServices(this._services, filter);
    }

    /** Tracks all services in the container. */
    protected serviceTracker: Record<string, {status: string; error: any}> = {}
    /** Tracks unresolved dependencies for each service in map. */
    protected dependencyGraph: Record<string, InjectDependency[]> = {};

    protected resolveDependencies(service: any, dependencies: InjectDependency[]): InjectDependency[] {
        const unresolvedDependencies: typeof dependencies = [];
        for (const [memberType, memberKey, filter] of dependencies) {
            const queryResults = this.findServices(filter);
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

    protected postBootServices: {service: any, method: string, priority: number}[] = [];

    bootService([guid, cls, _metadata]: ClassDecoratorRecord) {
        // @todo apply enabled

        let status = 'defined';
        let error: any = null;

        // @todo work out semantics for singleton/container (might need a singletonLiveServices module var)
        if (this.getService(_metadata.id)) {
            // console.warn(`🟡 Service ${metadata.id} is already registered`);
            status = 'error';
            error = `Service ${_metadata.id} is already registered`;
            this.serviceTracker[_metadata.id] = {status, error};
            return {metadata: _metadata, lastInjectorCount: 0, injector: () => 0, activator: async() => {}};
        }

        const service = new cls();
        const decoratedClassObject = getDecoratedClassObject(guid);
        const metadata = applyMetadataTransformers(_metadata, decoratedClassObject);

        status = 'pending';
        this.serviceTracker[metadata.id] = {status, error};

        const dependencies = [
            ...Object.entries(decoratedClassObject.properties.Inject ?? {}).map(([memberKey, filter]) => [0, memberKey, filter] as InjectDependency),
            ...Object.entries(decoratedClassObject.methods.Inject ?? {}).map(([memberKey, filter]) => [1, memberKey, filter] as InjectDependency),
        ]
        this.dependencyGraph[metadata.id] = dependencies;

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
            const activatorMethod = Object.keys((decoratedClassObject.methods.Activate??{}))[0];
            if (activatorMethod) {
                try {
                    await service[activatorMethod](metadata);
                    status = 'active';
                } catch (err) {
                    console.error('🔴 Error activating service', metadata.id, err);
                    status = 'error';
                    error = err;
                }
            } else {
                status = 'active';
            }

            me.register(metadata.id, service, metadata);
            console.log('ℹ️ bootService: ', status == 'active' ? '✅' : '⚠', metadata.id);
            me.serviceTracker[metadata.id] = {status, error};
            const postBootMethod = Object.keys((decoratedClassObject.methods.PostBoot??{}))[0];
            if (postBootMethod) {
                me.postBootServices.push({service, method: postBootMethod, priority: metadata.priority ?? SVC_PRIORITY_DEFAULT});
            }
            // @todo emit event 'serviceBooted'
        }

        return {metadata, lastInjectorCount: -1, injector, activator};
    }

    async bootContainer() {
        console.group('🟢 SmartContainer: start boot');

        const pendingServices: BootServiceDeferred[] = [];
        const annotatedServices = getClassesForDecorator('Service');
        for (const decRec of annotatedServices) {
            const metadata = normalizeServiceMetadata(decRec[2]);
            if (!this.isBundleIdEnabled(metadata.bundleId)) {
                console.log(`🔴`, {message: 'bundleId not enabled', metadata});
                continue;
            }
            if (!this.isRunModeEnabled(metadata.runModes ?? 'default')) {
                console.log(`🔴`, {message: 'runMode not enabled', metadata});
                continue;
            }

            const {injector, activator} = this.bootService(decRec);
            const lastInjectorCount = injector();
            if (lastInjectorCount == 0) {
                await activator();
            } else {
                pendingServices.push({metadata, lastInjectorCount, injector, activator});
            }
        }

        await this.resolvePendingServices(pendingServices);
        console.log('🟢 SmartContainer: end boot');
        await this.execPostBoot();
        console.groupEnd();
    }

    protected async execPostBoot() {
        console.log('🟢 SmartContainer: executing @PostBoot methods');
        for (const {service, method} of this.postBootServices.sort((a, b) => b.priority - a.priority)) {
            await service[method](this);
        }
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
        // container: new EventEmitter(),
        // services: new EventEmitter(),
    }

    listenOn(bus: keyof typeof this.eventBus, topic: string, listener: (...args: any[]) => void) {
        // this.eventBus[bus].on(topic, listener);
        // return () => this.eventBus[bus].off(topic, listener);
    }
}
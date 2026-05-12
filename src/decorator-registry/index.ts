export const KEY_GUID = Symbol("GUID");
export const KEY_PARENT_GUID = Symbol("PARENT_GUID");
export const KEY_PREFIX = "GUID_";
const EMPTY_GUID = Symbol();

export type ClassConstructor = any;
export type Metadata = Record<string, any>;
export type ClassDecoratorRecord = [symbol, Metadata];
export type ClassDecoratorMap = {
    guid: symbol;
    class: Record<string, Metadata>;
    properties: Record<string, Record<string, Metadata>>;
    propertiesStatic: Record<string, Record<string, Metadata>>;
    methods: Record<string, Record<string, Metadata>>;
    methodsStatic: Record<string, Record<string, Metadata>>;
}

let classNumber = 0;
const _classToDecorators: Record<symbol, [string, ClassConstructor, Metadata][]> = {};
const _classToDecoratedObject: Record<symbol, ClassDecoratorMap> = {};

const makeNewGuid = () => Symbol(`${KEY_PREFIX}${classNumber++}`);
const pushNewRecord = (guid: symbol) => {
    _classToDecorators[guid] = [];
    _classToDecoratedObject[guid] = {
        guid,
        class: {},
        properties: {},
        propertiesStatic: {},
        methods: {},
        methodsStatic: {},
    };
}

let lastConstructor: any = undefined;

/**
 * Injects a GUID into the constructor or prototype if GUID initialization is needed.
 * @param clazz Either a constructor function (for class and static members) or a prototype (for instance members)
 * @returns 
 */
const injectGuid = (clazz: any) => {
    const constructor = clazz, 
        prototype = clazz.prototype;
    const rootGuid = getGuid(clazz);
    if (prototype === undefined) {
        // case: instance member of a prototype that hasn't been processed yet
        // case: new constructor
        if (rootGuid === undefined || constructor !== lastConstructor) {
            clazz[KEY_GUID] = makeNewGuid();
            pushNewRecord(clazz[KEY_GUID]);
            lastConstructor = constructor;
        }
    } else {
        if (rootGuid === undefined) {
            // case: brand new class, has not been assigned guid yet
            prototype[KEY_GUID] = makeNewGuid();
            constructor[KEY_GUID] = prototype[KEY_GUID];
            pushNewRecord(clazz[KEY_GUID]);
            lastConstructor = constructor;
        } else if (prototype === lastConstructor) {
            // case: prototype assigned guid but first time at constructor level
            constructor[KEY_GUID] = rootGuid;
            lastConstructor = constructor;
        } else if (constructor !== lastConstructor) {
            // case: sub-class requiring new guid;
            prototype[KEY_GUID] = makeNewGuid();
            clazz[KEY_GUID] = prototype[KEY_GUID];
            pushNewRecord(clazz[KEY_GUID]);
            lastConstructor = constructor;
        }
    }
    return clazz;
}

export const getGuid = (clazz: any) => (clazz.prototype ?? clazz)[KEY_GUID]

export const setAndGetGuid = (clazz: any) => getGuid(injectGuid(clazz))

/**
 * @returns List of guids starting from root ancestor.
 */
export const getGuidInheritanceChain = (clazz: any) => {
    const guids: symbol[] = [];
    let ptr = clazz;
    while (ptr) {
        guids.push(getGuid(ptr));
        ptr = Object.getPrototypeOf(ptr);
    }
    return guids.filter(e => !!e).reverse();
}

// @todo don't store clazz references here!!

const _decoratorToClassses: Record<string, ClassDecoratorRecord[]> = {}
export const registerClassDecorator = (decorator: string, clazz: any, metadata: any) => {
    const guid = setAndGetGuid(clazz);
    if (!_decoratorToClassses[decorator]) {
        _decoratorToClassses[decorator] = [];
    }
    _decoratorToClassses[decorator].push([guid, metadata]);
    _classToDecorators[guid].push([decorator, clazz, metadata]);
    _classToDecoratedObject[guid].class[decorator] = metadata;
    return clazz;
}

export const getClassesForDecorator = (decorator: string) => _decoratorToClassses[decorator] ?? []

export const getDecoratorsForClass = (clazz: any) => {
    const guid = getGuid(clazz);
    return _classToDecorators[getGuid(clazz)]
}

export const getClassDecoratorMap = (guid: Symbol): ClassDecoratorMap => _classToDecoratedObject[guid as any]

/**
 * Performs a 2-level merge of decorated class maps a given class and all its ancestors.
 * By default, all decorators are merged. Supply a list of decorators to constrain merging.
 * @param clazz 
 * @param forDecorators 
 * @returns 
 */
export const getInheritedClassDecoratorMap = (clazz: any, forDecorators?: string[]) => {
    const guids = getGuidInheritanceChain(clazz);
    let mergedDecMap: ClassDecoratorMap = {
        guid: EMPTY_GUID,
        class: {},
        properties: {},
        propertiesStatic: {},
        methods: {},
        methodsStatic: {},
    };

    guids.forEach(guid => {
        // @ts-ignore ts being stupid
        const decMap: ClassDecoratorMap = getClassDecoratorMap(guid);
        Object.entries(decMap).forEach(([mapType, value]) => {
            if (mapType === 'guid' || typeof value !== 'object') return;
            const decoratorsToCopy = forDecorators ?? Object.keys(value);
            decoratorsToCopy.forEach(decorator => {
                const map = (mergedDecMap as any)[mapType] ?? {};
                if (!map[decorator]) {
                    map[decorator] = {};
                }
                Object.entries(value[decorator] ?? {}).forEach(([subKey, value]) => {
                    map[decorator][subKey] = value;
                });
            })
        });
    });

    return mergedDecMap;
}

export type PropertyDecoratorRecord = [string, Metadata];
const _decoratorToClassProps: Record<string, Record<symbol, PropertyDecoratorRecord[]>> = {};
export const registerPropertyDecorator = (decorator: string, clazz: any, property: string, metadata: any) => {
    const guid = setAndGetGuid(clazz);
    const isStatic = clazz.prototype !== undefined;
    const propsMap = isStatic ? _classToDecoratedObject[guid].propertiesStatic : _classToDecoratedObject[guid].properties;

    if (!_decoratorToClassProps[decorator]) {
        _decoratorToClassProps[decorator] = {};
    }
    if (!_decoratorToClassProps[decorator][guid]) {
        _decoratorToClassProps[decorator][guid] = [];
    }
    _decoratorToClassProps[decorator][guid].push([property, metadata]);
    if (!propsMap[decorator]) {
        propsMap[decorator] = {};
    }
    propsMap[decorator][property] = metadata;
}

export const getPropertyDecoratorsForClass = (decorator: string, clazz: any) => {
    const guid = getGuid(clazz);
    return _decoratorToClassProps[decorator]?.[guid ?? EMPTY_GUID] ?? []
}

export type MethodDecoratorRecord = [string, Metadata];
const _decoratorToClassMethods: Record<string, Record<symbol, MethodDecoratorRecord[]>> = {};
export const registerMethodDecorator = (decorator: string, clazz: any, method: string, metadata: any) => {
    const guid = setAndGetGuid(clazz);
    const isStatic = clazz.prototype !== undefined;
    const methodsMap = isStatic ? _classToDecoratedObject[guid].methodsStatic : _classToDecoratedObject[guid].methods;

    if (!_decoratorToClassMethods[decorator]) {
        _decoratorToClassMethods[decorator] = {};
    }
    if (!_decoratorToClassMethods[decorator][guid]) {
        _decoratorToClassMethods[decorator][guid] = [];
    }
    _decoratorToClassMethods[decorator][guid].push([method, metadata]);
    if (!methodsMap[decorator]) {
        methodsMap[decorator] = {};
    }
    methodsMap[decorator][method] = metadata;
}

export const getMethodDecoratorsForClass = (decorator: string, clazz: any) => {
    const guid = getGuid(clazz);
    return _decoratorToClassMethods[decorator]?.[guid ?? EMPTY_GUID] ?? []
}
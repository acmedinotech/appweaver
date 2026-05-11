export const KEY_GUID = Symbol("GUID");
export const KEY_PARENT_GUID = Symbol("PARENT_GUID");
export const KEY_PREFIX = "GUID_";
const EMPTY_GUID = Symbol();

export type ClassConstructor = any;
export type Metadata = any;
export type ClassDecoratorRecord = [symbol, ClassConstructor, Metadata];
export type DecoratedClassObject = {
    guid: symbol;
    class: Record<string, Metadata>;
    properties: Record<string, Record<string, Metadata>>;
    methods: Record<string, Record<string, Metadata>>;
}

let classNumber = 0;
const _classToDecorators: Record<symbol, [string, ClassConstructor, Metadata][]> = {};
const _classToDecoratedObject: Record<symbol, DecoratedClassObject> = {};

const makeNewGuid = () => Symbol(`${KEY_PREFIX}${classNumber++}`);
const pushNewRecord = (guid: symbol) => {
    _classToDecorators[guid] = [];
    _classToDecoratedObject[guid] = {
        guid,
        class: {},
        properties: {},
        methods: {},
    };
}

let lastConstructor: any = undefined;

/**
 * @param clazz Either a constructor function (for class and static members) or a prototype (for instance members)
 * @returns 
 */
const injectGuid = (clazz: any) => {
    const constructor = clazz, prototype = clazz.prototype;
    const rootGuid = getGuid(clazz);
    if (prototype === undefined) {
        lastConstructor = undefined;
        // case: instance member of a prototype that hasn't been processed yet
        if (rootGuid === undefined) {
            clazz[KEY_GUID] = makeNewGuid();
            pushNewRecord(clazz[KEY_GUID]);
        }
    } else {
        if (rootGuid === undefined) {
            // case: brand new class, has not been assigned guid yet
            prototype[KEY_GUID] = makeNewGuid();
            constructor[KEY_GUID] = prototype[KEY_GUID];
            pushNewRecord(clazz[KEY_GUID]);
            lastConstructor = constructor;
        } else if (lastConstructor === undefined) {
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

export const getGuid = (clazz: any) => {
    if (clazz[KEY_PARENT_GUID]) {
        return clazz[KEY_GUID];
    }
    return (clazz.prototype ?? clazz)[KEY_GUID];
}

export const setAndGetGuid = (clazz: any, fromMember = false) => getGuid(injectGuid(clazz))

/**
 * @returns List of guids starting from root ancestor.
 */
export const getClassGuidInheritance = (clazz: any) => {
    const guids: symbol[] = [];
    let ptr = getGuid(clazz);
    while (ptr) {
        guids.push(ptr);
        ptr = Object.getPrototypeOf(ptr);
    }
    return guids.reverse();
}

const _decoratorToClassses: Record<string, ClassDecoratorRecord[]> = {}
export const registerClassDecorator = (decorator: string, clazz: any, metadata: any) => {
    const guid = setAndGetGuid(clazz);
    if (!_decoratorToClassses[decorator]) {
        _decoratorToClassses[decorator] = [];
    }
    _decoratorToClassses[decorator].push([guid, clazz, metadata]);
    _classToDecorators[guid].push([decorator, clazz,metadata]);
    _classToDecoratedObject[guid].class[decorator] = metadata;
    return clazz;
}

export const getClassesForDecorator = (decorator: string) => _decoratorToClassses[decorator] ?? []

export const getDecoratorsForClass = (clazz: any) => _classToDecorators[getGuid(clazz)]

export const getDecoratedClassObject = (guid: Symbol) => _classToDecoratedObject[guid as any]

export type PropertyDecoratorRecord = [string, Metadata];
const _decoratorToClassProps: Record<string, Record<symbol, PropertyDecoratorRecord[]>> = {};
export const registerPropertyDecorator = (decorator: string, clazz: any, property: string, metadata: any) => {
    const guid = setAndGetGuid(clazz, true);
    const isStatic = clazz.prototype === undefined;

    if (!_decoratorToClassProps[decorator]) {
        _decoratorToClassProps[decorator] = {};
    }
    if (!_decoratorToClassProps[decorator][guid]) {
        _decoratorToClassProps[decorator][guid] = [];
    }
    _decoratorToClassProps[decorator][guid].push([property, metadata]);
    if (!_classToDecoratedObject[guid].properties[decorator]) {
        _classToDecoratedObject[guid].properties[decorator] = {};
    }
    _classToDecoratedObject[guid].properties[decorator][property] = metadata;
}

export const getPropertyDecoratorsForClass = (decorator: string, clazz: any) => {
    const guid = getGuid(clazz);
    return _decoratorToClassProps[decorator]?.[guid ?? EMPTY_GUID] ?? []
}

export type MethodDecoratorRecord = [string, Metadata];
const _decoratorToClassMethods: Record<string, Record<symbol, MethodDecoratorRecord[]>> = {};
export const registerMethodDecorator = (decorator: string, clazz: any, method: string, metadata: any) => {
    const guid = setAndGetGuid(clazz, true);
    if (!_decoratorToClassMethods[decorator]) {
        _decoratorToClassMethods[decorator] = {};
    }
    if (!_decoratorToClassMethods[decorator][guid]) {
        _decoratorToClassMethods[decorator][guid] = [];
    }
    _decoratorToClassMethods[decorator][guid].push([method, metadata]);
    if (!_classToDecoratedObject[guid].methods[decorator]) {
        _classToDecoratedObject[guid].methods[decorator] = {};
    }
    _classToDecoratedObject[guid].methods[decorator][method] = metadata;
}

export const getMethodDecoratorsForClass = (decorator: string, clazz: any) => {
    const guid = getGuid(clazz);
    return _decoratorToClassMethods[decorator]?.[guid ?? EMPTY_GUID] ?? []
}
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
    decoratorToProps: Record<string, [string, Metadata][]>;
    decoratorToMethods: Record<string, [string, Metadata][]>;
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
        decoratorToProps: {},
        decoratorToMethods: {},
    };
}

let lastConstructor: any = undefined;

/**
 * @param clazz Either a constructor function or a class. If a class is provided, the prototype is
 * used to store the GUID.
 * @returns 
 */
const injectGuid = (clazz: any, fromMember = false) => {
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

export const setAndGetGuid = (clazz: any, fromMember = false) => getGuid(injectGuid(clazz, fromMember))

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

export const getDecoratorsForClass = (clazz: any) => _classToDecorators[setAndGetGuid(clazz)]

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
    if (!_classToDecoratedObject[guid].decoratorToProps[decorator]) {
        _classToDecoratedObject[guid].decoratorToProps[decorator] = [];
    }
    _classToDecoratedObject[guid].decoratorToProps[decorator].push([property, metadata]);
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
    // if (!_classToDecoratedObject[guid].methods[method]) {
    //     _classToDecoratedObject[guid].methods[method] = {};
    // }
    // _classToDecoratedObject[guid].methods[method][decorator] = metadata;
    if (!_classToDecoratedObject[guid].decoratorToMethods[decorator]) {
        _classToDecoratedObject[guid].decoratorToMethods[decorator] = [];
    }
    _classToDecoratedObject[guid].decoratorToMethods[decorator].push([method, metadata]);
}

export const getMethodDecoratorsForClass = (decorator: string, clazz: any) => {
    const guid = getGuid(clazz);
    return _decoratorToClassMethods[decorator]?.[guid ?? EMPTY_GUID] ?? []
}
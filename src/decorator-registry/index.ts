export const KEY_GUID = Symbol("GUID");
export const KEY_PREFIX = "GUID_";
const EMPTY_GUID = Symbol();

export type ClassConstructor = any;
export type Metadata = any;
export type ClassDecoratorRecord = [symbol, ClassConstructor, Metadata];
export type DecoratedClassObject = {
    class: Record<string, Metadata>;
    decoratorToProps: Record<string, [string, Metadata][]>;
    decoratorToMethods: Record<string, [string, Metadata][]>;
}

let classNumber = 0;
const _classToDecorators: Record<symbol, [string, ClassConstructor, Metadata][]> = {};
const _classToDecoratedObject: Record<symbol, DecoratedClassObject> = {};

/**
 * @param clazz Either a constructor function or a class. If a class is provided, the prototype is
 * used to store the GUID.
 * @returns 
 */
const injectGuid = (clazz: any) => {
    const ptr = clazz.prototype ?? clazz;
    if (!ptr[KEY_GUID]) {
        ptr[KEY_GUID] = Symbol(`${KEY_PREFIX}${classNumber++}`);
        _classToDecorators[ptr[KEY_GUID]] = [];
        _classToDecoratedObject[ptr[KEY_GUID]] = {
            class: {},
            decoratorToProps: {},
            decoratorToMethods: {},
        };
    }
    return clazz;
}

export const getGuid = (clazz: any) => (clazz.prototype ?? clazz)[KEY_GUID] ?? null;

export const setAndGetGuid = (clazz: any) => getGuid(injectGuid(clazz))

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
    const guid = setAndGetGuid(clazz);
    if (!_decoratorToClassProps[decorator]) {
        _decoratorToClassProps[decorator] = {};
    }
    if (!_decoratorToClassProps[decorator][guid]) {
        _decoratorToClassProps[decorator][guid] = [];
    }
    _decoratorToClassProps[decorator][guid].push([property, metadata]);
    // if (!_classToDecoratedObject[guid].properties[property]) {
    //     _classToDecoratedObject[guid].properties[property] = {};
    // }
    // _classToDecoratedObject[guid].properties[property][decorator] = metadata;
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
    const guid = setAndGetGuid(clazz);
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
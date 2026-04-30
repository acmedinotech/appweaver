export const KEY_GUID = Symbol("GUID");
export const KEY_PREFIX = "GUID_";
const EMPTY_GUID = Symbol();

let classNumber = 0;
const _classToDecorators: Record<symbol, [string, any][]> = {};

/**
 * Attach static property holding GUID if not present.
 * @param clazz 
 * @returns 
 */
const injectGuid = (clazz: any) => {
    const ptr = clazz.prototype ?? clazz;
    if (!ptr[KEY_GUID]) {
        ptr[KEY_GUID] = Symbol(`${KEY_PREFIX}${classNumber++}`);
        _classToDecorators[ptr[KEY_GUID]] = [];
    }
    return clazz;
}

export const getGuid = (clazz: any) => (clazz.prototype ?? clazz)[KEY_GUID] ?? null;

export const setAndGetGuid = (clazz: any) => {
    injectGuid(clazz);
    return getGuid(clazz);
}

const _decoratorToClassses: Record<string, [symbol, any][]> = {}
export const registerClassDecorator = (decorator: string, clazz: any, metadata: any) => {
    const guid = setAndGetGuid(clazz);
    if (!_decoratorToClassses[decorator]) {
        _decoratorToClassses[decorator] = [];
    }
    _decoratorToClassses[decorator].push([guid, metadata]);
    _classToDecorators[guid].push([decorator, metadata]);
    return clazz;
}

export const getClassesForDecorator = (decorator: string) => _decoratorToClassses[decorator] ?? []

export const getDecoratorsForClass = (clazz: any) => _classToDecorators[setAndGetGuid(clazz)]

const _decoratorToClassProps: Record<string, Record<symbol, [string, any][]>> = {};
export const registerPropertyDecorator = (decorator: string, clazz: any, property: string, metadata: any) => {
    const guid = setAndGetGuid(clazz);
    if (!_decoratorToClassProps[decorator]) {
        _decoratorToClassProps[decorator] = {};
    }
    if (!_decoratorToClassProps[decorator][guid]) {
        _decoratorToClassProps[decorator][guid] = [];
    }
    _decoratorToClassProps[decorator][guid].push([property, metadata]);
}

export const getPropertyDecoratorsForClass = (decorator: string, clazz: any) => {
    const guid = getGuid(clazz);
    return _decoratorToClassProps[decorator]?.[guid ?? EMPTY_GUID] ?? []
}

const _decoratorToClassMethods: Record<string, Record<symbol, [string, any][]>> = {};
export const registerMethodDecorator = (decorator: string, clazz: any, method: string, metadata: any) => {
    const guid = setAndGetGuid(clazz);
    if (!_decoratorToClassMethods[decorator]) {
        _decoratorToClassMethods[decorator] = {};
    }
    if (!_decoratorToClassMethods[decorator][guid]) {
        _decoratorToClassMethods[decorator][guid] = [];
    }
    _decoratorToClassMethods[decorator][guid].push([method, metadata]);
}

export const getMethodDecoratorsForClass = (decorator: string, clazz: any) => {
    const guid = getGuid(clazz);
    return _decoratorToClassMethods[decorator]?.[guid ?? EMPTY_GUID] ?? []
}
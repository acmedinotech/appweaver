export const KEY_GUID = Symbol("GUID");
export const KEY_PREFIX = "GUID_";

let classNumber = 0;
export const getOrSetGuid = (clazz: any) => {
    if (!clazz[KEY_GUID]) {
        clazz[KEY_GUID] = Symbol(`${KEY_PREFIX}${classNumber++}`);
    }
    return clazz[KEY_GUID];
}

export type DecoratorMetadataMap = Record<string, Record<symbol, any>>;

const _classDecorators: Record<string, [symbol, any][]> = {}

export const registerClassDecorator = (decName: string, clazz: any, metadata: any) => {
    if (!_classDecorators[decName]) {
        _classDecorators[decName] = [];
    }
    _classDecorators[decName].push([getOrSetGuid(clazz), metadata]);
}

const _propertyDecorators: Record<string, Record<symbol, [string, any][]>> = {};

export const registerPropertyDecorator = (decName: string, clazz: any, property: string, metadata: any) => {
    const clazzGuid = getOrSetGuid(clazz);
    if (!_propertyDecorators[decName]) {
        _propertyDecorators[decName] = {};
    }
    if (!_propertyDecorators[decName][clazzGuid]) {
        _propertyDecorators[decName][clazzGuid] = [];
    }
    _propertyDecorators[decName][clazzGuid].push([property, metadata]);
}
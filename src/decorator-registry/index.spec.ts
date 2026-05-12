import { getClassesForDecorator, getDecoratorsForClass, getInheritedClassDecoratorMap, getMethodDecoratorsForClass, getPropertyDecoratorsForClass } from ".";
import { registerClassDecorator, registerMethodDecorator, registerPropertyDecorator } from "../decorator-registry"

const ClassMeta = (metadata: any) => {
    return (target: any) => {
        registerClassDecorator('ClassMeta', target, metadata);
        return target;
    }
}

const PropertyMeta = (metadata: any) => {
    return (target: any, property: string) => {
        registerPropertyDecorator('PropertyMeta', target, property, metadata);
    }
}

const MethodMeta = (metadata: any) => {
    return (target: any, property: string, descriptor: PropertyDescriptor) => {
        registerMethodDecorator('MethodMeta', target, property, metadata);
        return descriptor;
    }
}

@ClassMeta({
    name: 'BaseClass',
    description: 'BaseClass-description',
    lastTouched: 'BaseClass'
})
class BaseClass {
    @PropertyMeta({ name: 'prop1', required: true })
    prop1 = "";

    @MethodMeta({ name: 'method1', })
    method1() {}
}

@ClassMeta({
    name: 'ChildOfBaseClass',
    description: 'ChildOfBaseClass-description',
})
class ChildOfBaseClass extends BaseClass {
    @PropertyMeta({ name: 'prop1_override', required: false })
    prop1 = "";

    @MethodMeta({ override: true })
    method1() {}
}

@ClassMeta({ name: 'BaseClass2', })
class BaseClass2 { }

[BaseClass, BaseClass2, ChildOfBaseClass];

describe('decorator-registry', () => {
    it('registers 3 class decorators for @ClassMeta', () => {
        const classes = getClassesForDecorator('ClassMeta')
            .map(([guid, metadata]) => [typeof guid, metadata]);
        expect(classes).toEqual([
            [
                "symbol",
                {
                    "name": "BaseClass",
                    "description": "BaseClass-description",
                    "lastTouched": "BaseClass"
                }
            ],
            [
                "symbol",
                {
                    "name": "ChildOfBaseClass",
                    "description": "ChildOfBaseClass-description"
                }
            ],
            [
                "symbol",
                {
                    "name": "BaseClass2"
                }
            ]
        ]);
    });

    it('registers 1 @PropertyMeta for ChildOfBaseClass', () => {
        const properties = getPropertyDecoratorsForClass('PropertyMeta', ChildOfBaseClass)
        const [propName, metadata] = properties[0];
        expect(propName).toBe('prop1');
        expect(metadata).toEqual({ name: 'prop1_override', required: false });
    });

    describe('#getInheritedClassDecoratorMap()', () => {
        it('gets merged decorator map of ChildOfBaseClass', () => {
            const {guid, propertiesStatic, methodsStatic,...mergedMap} = getInheritedClassDecoratorMap(ChildOfBaseClass);
            expect({
                class: {
                    ClassMeta: {
                        name: 'ChildOfBaseClass',
                        description: 'ChildOfBaseClass-description',
                        lastTouched: 'BaseClass'
                    }
                },
                properties: {
                    PropertyMeta: {
                        prop1: {
                            name: 'prop1_override',
                            required: false
                        }
                    }
                },
                methods: {
                    MethodMeta: {
                        method1: {
                            name: 'method1',
                            override: true
                        }
                    }
                }
            }).toMatchObject(mergedMap);
        });
        it('gets partialmerged decorator map of ChildOfBaseClass (ClassMeta, PropertyMeta)', () => {
            const {guid, propertiesStatic, methodsStatic,...mergedMap} = getInheritedClassDecoratorMap(ChildOfBaseClass, ['ClassMeta', 'PropertyMeta']);
            expect({
                class: {
                    ClassMeta: {
                        name: 'ChildOfBaseClass',
                        description: 'ChildOfBaseClass-description',
                        lastTouched: 'BaseClass'
                    },
                    PropertyMeta: {}
                },
                properties: {
                    ClassMeta: {},
                    PropertyMeta: {
                        prop1: {
                            name: 'prop1_override',
                            required: false
                        }
                    }
                },
                methods: {
                    ClassMeta: {},
                    PropertyMeta: {}
                }
            }).toMatchObject(mergedMap);
        });
    });
});
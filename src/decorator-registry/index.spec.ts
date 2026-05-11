import { getClassesForDecorator, getDecoratorsForClass, getMethodDecoratorsForClass, getPropertyDecoratorsForClass } from ".";
import { registerClassDecorator, registerMethodDecorator, registerPropertyDecorator } from "../decorator-registry"

const Dec1Class = (metadata: any) => {
    return (target: any) => {
        registerClassDecorator('Dec1Class', target, metadata);
        return target;
    }
}

const Dec2Property = (metadata: any) => {
    return (target: any, property: string) => {
        registerPropertyDecorator('Dec2Property', target, property, metadata);
    }
}

const Dec3Method = (metadata: any) => {
    return (target: any, property: string, descriptor: PropertyDescriptor) => {
        registerMethodDecorator('Dec3Method', target, property, metadata);
        return descriptor;
    }
}

@Dec1Class({
    name: 'TestClass',
})
export class TestClass {
    @Dec2Property({
        name: 'publicString',
    })
    publicString = "publicString";
    @Dec2Property({
        name: 'protectedString',
    })
    protected protectedString = "protectedString";
    @Dec2Property({
        name: 'privateString',
    })
    private privateString = "privateString";

    @Dec3Method({
        name: 'method1',
    })
    method1() {
        return 'method1';
    }
}

@Dec1Class({
    name: 'TestClass2',
})
export class TestClass2 {}

describe('decorator registry', () => {
    const autowire = [TestClass, TestClass2];

    it('should get classes for decorator:Dec1Class', () => {
        const decorators = getClassesForDecorator('Dec1Class');
        expect(decorators).toHaveLength(2);
        expect(decorators[0][2]).toEqual({ name: 'TestClass' });
        expect(decorators[1][2]).toEqual({ name: 'TestClass2' });
    });

    it('should get decorators for class:TestClass', () => {
        const decorators = getDecoratorsForClass(TestClass);
        expect(decorators).toEqual([['Dec1Class', TestClass,{ name: 'TestClass' }]]);
    });
    
    it('should get properties for decorator:Dec2Property && class:TestClass', () => {
        const properties = getPropertyDecoratorsForClass('Dec2Property', TestClass);
        expect(properties).toEqual(    [
            [ 'publicString', { name: 'publicString' } ],
            [ 'protectedString', { name: 'protectedString' } ],
            [ 'privateString', { name: 'privateString' } ]
          ])
    });

    it('should get methods for decorator:Dec3Method && class:TestClass', () => {
        const methods = getMethodDecoratorsForClass('Dec3Method', TestClass);
        expect(methods).toEqual([['method1', { name: 'method1' }]])
    });
});
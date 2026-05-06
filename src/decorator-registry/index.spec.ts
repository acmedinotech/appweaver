import { getClassesForDecorator, getDecoratorsForClass, getMethodDecoratorsForClass, getPropertyDecoratorsForClass } from ".";
import { TestClass, TestClass2 } from "../test-data/decorator-registry";

describe('decorator registry', () => {
    const autowire = [TestClass, TestClass2];

    it('should get classes for decorator:Dec1Class', () => {
        const decorators = getClassesForDecorator('Dec1Class');
        // expect(decorators).toHaveLength(2);
        expect(decorators[0][1]).toEqual({ name: 'TestClass' });
        // expect(decorators[1][1]).toEqual({ name: 'TestClass2' });
    });

    it('should get decorators for class:TestClass', () => {
        const decorators = getDecoratorsForClass(TestClass);
        expect(decorators).toEqual([['Dec1Class', { name: 'TestClass' }]]);
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
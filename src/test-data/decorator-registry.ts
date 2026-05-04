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
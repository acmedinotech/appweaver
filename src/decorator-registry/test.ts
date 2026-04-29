const classDecorator = (...args: any[]) => {
    console.log("classDecorator.0", args);
    return (target: any) => {
        console.log("classDecorator.1", target);
        return target;
    }
}

const propertyDecorator = (target: any, propertyKey: string) => {
    console.log("propertyDecorator", target, propertyKey);
    return target[propertyKey];
}

const methodDecorator = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    console.log("methodDecorator", target, propertyKey, descriptor);
    return descriptor.value;
}
const parameterDecorator = (...args: any[]) => {
    console.log("parameterDecorator.0", args);
    return (target: any, propertyKey: string, index: number) => {
        console.log("parameterDecorator.1", target, propertyKey, index);
        return target[propertyKey][index];
    }
}

@classDecorator(1, 2, "3")
class TestDecorators {
    @propertyDecorator
    protected propProtected = "propProtected";
    @methodDecorator
    protected methodProtected(...args: any[]) {
        console.log("methodProtected");
    }
    
    methodPublic(@parameterDecorator(1, 2, "3") arg1: any, arg2: any) {
        console.log("methodPublic", arg1, arg2);
    }
}
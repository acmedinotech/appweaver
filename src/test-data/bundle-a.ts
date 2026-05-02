import { Service } from "../smart-container/decorators";

@Service({
    id: 'test-data.bundle-a.DummServiceA',
    interfaces: ['test-data.bundle-a.DummServiceA'],
    priority: 100,
    lifecycle: 'singleton',
    enabled: true,
    runModes: ['test'],
})
export class DummyServiceA {
    activate() {
        console.log('DummServiceA.activate');
    }

    deactivate() {
        console.log('DummServiceA.deactivate');
    }
}

export const autowire = [DummyServiceA];
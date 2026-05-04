import { Activate, Deactivate, Inject, Service } from "../smart-container/decorators";

@Service({
    id: 'DummyServiceA',
    bundleId: 'test-data.bundle-a',
})
export class DummyServiceA {
    activated = 0;

    @Inject('DummyServiceB')
    dummyServiceB: DummyServiceB|undefined;

    @Activate()
    activate() {
        this.activated = 1;
        console.log('DummyServiceA.activate');
    }

    @Deactivate()
    deactivate() {
        this.activated = -1
        console.log('DummyServiceA.deactivate');
    }


}

@Service({
    id: 'DummyServiceB',
    bundleId: 'test-data.bundle-a',
})
export class DummyServiceB {
    initialized = 0
    @Activate()
    initialize() {
        this.initialized = 1;
        console.log('DummyServiceB.activate');
    }
}

export const autowire = [DummyServiceA, DummyServiceB];
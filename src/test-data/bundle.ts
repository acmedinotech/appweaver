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
        console.log('DummServiceA.activate');
    }

    @Deactivate()
    deactivate() {
        this.activated = -1
        console.log('DummServiceA.deactivate');
    }

    // @Inject('DummyServiceB')
    // setDummyServiceB(dummyServiceB: DummyServiceB) {
    // }
}

@Service({
    id: 'DummyServiceB',
    bundleId: 'test-data.bundle-a',
})
export class DummyServiceB {
}

export const autowire = [DummyServiceA, DummyServiceB];
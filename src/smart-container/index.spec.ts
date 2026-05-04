import { SmartContainer } from ".";
import { TestClass } from "../test-data/decorator-registry";
import { autowire, DummyServiceA, DummyServiceB } from "../test-data/bundle";
import { getServiceMetadata } from "./decorators";

describe('class SmartContainer', () => {
    const container = new SmartContainer();
    // root @Service classes need to be processed before bootContainer() is called--
    // do this by directly referencing the module autowire export.
    autowire;

    beforeAll(async () => {
        await container.bootContainer();
    });

    const idA = 'DummyServiceA';
    const idB = 'DummyServiceB';

    it('resolved dependencies',  () => {
        const svcA = container.getService<DummyServiceA>(idA);
        const svcB = container.getService<DummyServiceB>(idB);
        expect(svcA).toBeDefined();
        expect(svcB).toBeDefined();
    });

    it('activated services',  () => {
        const svcA = container.getService<DummyServiceA>(idA);
        const svcB = container.getService<DummyServiceB>(idB);
        expect(svcA.activated).toBe(1);
        expect(svcB.initialized).toBe(1);
    });

    it('injected dependencies',  () => {
        const svcA = container.getService<DummyServiceA>(idA);
        const svcB = container.getService<DummyServiceB>(idB);
        expect(svcA.dummyServiceB).toEqual(svcB);
    });
});
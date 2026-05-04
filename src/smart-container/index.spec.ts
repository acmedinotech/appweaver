import { SmartContainer } from ".";
import { TestClass } from "../test-data/decorator-registry";
import { DummyServiceA, DummyServiceB } from "../test-data/bundle";
import { getServiceMetadata } from "./decorators";

describe('smart-container', () => {
    it('should register a service', () => {
        const container = new SmartContainer();
        container.register('direct.testClass', new TestClass());
        expect(container.getService('direct.testClass')).toBeDefined();
    });

    it('should boot the container with bundleId=*', async () => {
        const container = new SmartContainer();
        // container.register('direct.testClass', new TestClass());
        await container.bootContainer();
        expect(container.getService(getServiceMetadata(DummyServiceA).id)).toBeDefined();
        expect(container.getService(getServiceMetadata(DummyServiceB).id)).toBeDefined();
    });
});
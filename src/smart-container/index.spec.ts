import { SmartContainer } from ".";
import { TestClass } from "../test-data/decorator-registry";
import * as bundleA from "../test-data/bundle-a";
import { getServiceMetadata } from "./decorators";
import * as bundleB from "../test-data/bundle-b";

describe('class SmartContainer', () => {
    // root @Service classes need to be processed before bootContainer() is called
    // do this by directly referencing the module autowire export.
    bundleA.autowire;
    describe('basic DI & activation', () => {
        const container = new SmartContainer({
            bundleIds: { [bundleA.bundleId]: true },
            runModes: {default: true},
        });
    
        beforeAll(async () => {
            await container.bootContainer();
        });
    
        const idA = 'DummyServiceA';
        const idB = 'DummyServiceB';
    
        it('resolved dependencies',  () => {
            const svcA = container.getService<bundleA.DummyServiceA>(idA);
            const svcB = container.getService<bundleA.DummyServiceB>(idB);
            expect(svcA).toBeDefined();
            expect(svcB).toBeDefined();
        });
    
        it('activated services',  () => {
            const svcA = container.getService<bundleA.DummyServiceA>(idA);
            const svcB = container.getService<bundleA.DummyServiceB>(idB);
            expect(svcA.activated).toBe(1);
            expect(svcB.initialized).toBe(1);
        });
    
        it('injected dependencies',  () => {
            const svcA = container.getService<bundleA.DummyServiceA>(idA);
            const svcB = container.getService<bundleA.DummyServiceB>(idB);
            expect(svcA.dummyServiceB).toEqual(svcB);
        }); 
    });

    describe('parsed config w/ bundleId & runMode constraints', () => {
        bundleB.autowire;
        const container = new SmartContainer({
            bundleIds: { [bundleB.bundleId]: true },
            runModes: { default: true, 'test-active': true},
        });

        beforeAll(async () => {
            await container.bootContainer();
        });

        it('detects NODE_ENV', () => {
            expect(container.isEnvDev()).toBe(false);
            expect(container.isEnvTest()).toBe(true);
            expect(container.isEnvProd()).toBe(false);
        });

        it('detects bundleId by config', () => {
            expect(container.isBundleIdEnabled(bundleA.bundleId)).toBe(false);
            expect(container.isBundleIdEnabled(bundleB.bundleId)).toBe(true);
        });

        it('detects runMode by config', () => {
            expect(container.isRunModeEnabled('test-active')).toBe(true);
            expect(container.isRunModeEnabled('test-inactive')).toBe(false);
        });

        it('enforces bundleId constraints', () => {
            expect(container.getService('DummyServiceA')).toBeUndefined();
            expect(container.getService('DummyServiceB')).toBeUndefined();
        });

        it('enforces runMode constraints', () => {
            expect(container.getService('SvcAlwaysEnabled')).toBeDefined();
            expect(container.getService('SvcRunModeEnabled')).toBeDefined();
            expect(container.getService('SvcRunModeDisabled')).toBeUndefined();
        });
    });
});
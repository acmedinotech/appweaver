// CONVENTION: `bundleId` should be a unique identifier for your module. Note that is only expected at the root

import { Service } from "../smart-container/decorators";

// of all the bundled services you want to group together.
export const bundleId = 'simpleModule';

// this class will be registered in the container as `SimpleService` belonging to the bundleId. NOTE that the service id is unique to the container, not just the bundle.
@Service({id: 'SimpleService', bundleId})
export class SimpleService {
    getTime() {
        return new Date().toISOString();
    }
}

// CONVENTION: put all your exposed services in `autowire`. this allows the application importing your bundle
// to easily force nodejs to process the classes (and their decorators)
export const autowire = [SimpleService];
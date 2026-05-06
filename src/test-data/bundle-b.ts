import { Activate, Deactivate, Inject, Service } from "../smart-container/decorators";

export const bundleId = 'test-data.bundle-b';

@Service({
    id: 'SvcAlwaysEnabled',
    bundleId,
})
export class SvcAlwaysEnabled {
}

@Service({
    id: 'SvcRunModeEnabled',
    bundleId,
    runModes: ['test-active']
})
export class SvcRunModeEnabled {
   
}

@Service({
    id: 'SvcRunModeDisabled',
    bundleId,
    runModes: ['test-inactive']
})
export class SvcRunModeDisabled {
   
}

export const autowire = [SvcAlwaysEnabled, SvcRunModeEnabled, SvcRunModeDisabled];
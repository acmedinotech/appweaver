import { SmartContainer } from '../smart-container';
import { Inject, PostBoot, Service } from '../smart-container/decorators';
import * as bundle from './simpleModule';

// this is your application service
@Service({id: 'SampleApp'})
class SampleApp {
    // supply the id of the exported service you depend on
    @Inject('SimpleService')
    simpleService = undefined as unknown as bundle.SimpleService;

    @PostBoot()
    async appStart() {
        console.log(`SampleApp app is running! SimpleService says the time is: ${this.simpleService.getTime()}`);
    }
}

// force processing of bundle code
bundle.autowire;

// create your container and enable the bundleIds you want to include services from
// (or enable `*` to include all imported bundles)
const container = new SmartContainer({
    bundleIds: {'*': true}
})

container.bootContainer().then(() => {
    console.log('container is booted!')
})
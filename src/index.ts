import { SmartContainer } from "./smart-container";
import * as bundleA from './test-data/bundle-a';

const app = new SmartContainer();
bundleA.autowire;

app.bootContainer().then(() => {
    console.log('Container booted');
}).catch((err) => {
    console.error(err);
})
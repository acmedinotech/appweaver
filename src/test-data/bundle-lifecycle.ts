import type { SmartContainer } from "../smart-container";
import { PostBoot, Service } from "../smart-container/decorators";

export const bundleId = 'bundle-lifecycle';

let bootCounter = 0;

@Service({
    id: 'PostBoot1',
    priority: 10,
    bundleId
})
export class PostBoot1 {
    bootAt = 0;
    @PostBoot()
    postBoot(container: SmartContainer) {
        this.bootAt = ++bootCounter + (container ? 1 : 0);
    }
}

@Service({
    id: 'PostBoot2',
    priority: 100,
    bundleId
})
export class PostBoot2 {
    bootAt = 0;
    @PostBoot()
    postBoot(container: SmartContainer) {
        console.log('🟢 PostBoot2: postBoot');
        this.bootAt = ++bootCounter + (container ? 1 : 0);
    }
}

// @todo test inheritance with PostBoot3
export const autowire = [PostBoot1, PostBoot2];
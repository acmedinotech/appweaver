export * from "./types";
import type { ServiceOptions } from "./types";


export const fromClass = (cls: any, opts: ServiceOptions) => {
}

export const fromFactory = (factory: () => any, opts: ServiceOptions) => {

}


const _singletons = {};

export class ContainerBoot {
    register() {}
    queueService() {}
    queueBundle() {}
    async bootQueue() {} 
    get() {}
}
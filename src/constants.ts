export const APPWEAVER_ENV_PREFIX = 'APPWEAVER_';

export enum AWEnvVars {
    RUN_MODES = 'RUN_MODES',
    BUNDLE_IDS = 'BUNDLE_IDS',
}

export class AppWeaverError extends Error {
    contextName: string;
    properties: Record<string, any> | undefined;
    constructor(message: string, contextName: string = 'appweaver.generic', properties?: Record<string, any>) {
        super(message);
        this.contextName = contextName;
        this.properties = properties;
    }

    toJson() {
        return {
            contextName: this.contextName,
            message: this.message,
            properties: this.properties
        }
    }
}

export class AppWeaverSuccess {
    message: string;
    contextName: string;
    properties: Record<string, any> | undefined;

    constructor(message: string, contextName: string = 'appweaver.success', properties?: Record<string, any>) {
        this.message = message;
        this.contextName = contextName;
        this.properties = properties;
    }
}
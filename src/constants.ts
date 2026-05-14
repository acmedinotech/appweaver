export const APPWEAVER_ENV_PREFIX = 'APPWEAVER_';

export enum AWEnvVars {
    RUN_MODES = 'RUN_MODES',
    BUNDLE_IDS = 'BUNDLE_IDS',
}

export const errorToJson = (error: any) => {
    if (error.toJSON) {
        return error.toJSON();
    }
    if (error instanceof Error) {
        return {
            ...error
        }
    }
    if (typeof error === 'object') {
        return {
            message: error.message ?? `unknown-error`,
            ...error
        }
    }
    
    return {
        error: JSON.stringify(error)
    }
}
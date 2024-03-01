import type { Request } from '../../models/request';

export interface RequestContext {
    request: Request;
    timelinePath: string;
    environment?: object;
    baseEnvironment?: object;
    collectionVariables?: object;
    globals?: object;
    iterationData?: object;
}

export const unsupportedError = (featureName: string, alternative?: string) => {
    const message = `${featureName} is not supported yet` +
        (alternative ? `, please use ${alternative} instead temporarily.` : '');
    return Error(message);
};

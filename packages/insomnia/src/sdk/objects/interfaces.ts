import type { Request } from '../../models/request';

export interface RequestContext {
    request: Request;
    timelinePath: string;
    environment?: object;
    baseEnvironment?: object;
    collectionVariables?: object;
    globals?: object;
    iterationData?: object;
    timeout: number;
}

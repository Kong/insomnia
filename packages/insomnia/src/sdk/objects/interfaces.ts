import { ClientCertificate } from '../../models/client-certificate';
import type { Request } from '../../models/request';
import { Settings } from '../../models/settings';

export interface RequestContext {
    request: Request;
    timelinePath: string;
    environment?: object;
    baseEnvironment?: object;
    collectionVariables?: object;
    globals?: object;
    iterationData?: object;
    timeout: number;
    settings: Settings;
    clientCertificates: ClientCertificate[];
}

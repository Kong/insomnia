import { ClientCertificate } from '../../models/client-certificate';
import { CookieJar as InsomniaCookieJar } from '../../models/cookie-jar';
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
    cookieJar: InsomniaCookieJar;
}

import { CookieJar as InsomniaCookieJar } from 'insomnia/src//models/cookie-jar';
import { ClientCertificate } from 'insomnia/src/models/client-certificate';
import type { Request } from 'insomnia/src/models/request';
import { Settings } from 'insomnia/src/models/settings';

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

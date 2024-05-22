import { CookieJar as InsomniaCookieJar } from 'insomnia/src//models/cookie-jar';
import { ClientCertificate } from 'insomnia/src/models/client-certificate';
import type { Request } from 'insomnia/src/models/request';
import { Settings } from 'insomnia/src/models/settings';
import { sendCurlAndWriteTimelineError, sendCurlAndWriteTimelineResponse } from 'insomnia/src/network/network';

export interface RequestContext {
    request: Request;
    timelinePath: string;
    environment?: object;
    environmentName?: string;
    baseEnvironment?: object;
    baseEnvironmentName?: string;
    collectionVariables?: object;
    globals?: object;
    iterationData?: object;
    timeout: number;
    settings: Settings;
    clientCertificates: ClientCertificate[];
    cookieJar: InsomniaCookieJar;
    // only for the after-response script
    response?: sendCurlAndWriteTimelineResponse | sendCurlAndWriteTimelineError;
}

import type { ClientCertificate } from 'insomnia/src/models/client-certificate';
import type { CookieJar as InsomniaCookieJar } from 'insomnia/src/models/cookie-jar';
import type { Request } from 'insomnia/src/models/request';
import type { Settings } from 'insomnia/src/models/settings';
import type { sendCurlAndWriteTimelineError, sendCurlAndWriteTimelineResponse } from 'insomnia/src/network/network';

export interface RequestContext {
    request: Request;
    timelinePath: string;
    environment: {
        id: string;
        name: string;
        data: object;
    };
    baseEnvironment: {
        id: string;
        name: string;
        data: object;
    };
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

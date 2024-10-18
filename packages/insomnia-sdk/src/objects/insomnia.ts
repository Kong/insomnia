import { expect } from 'chai';
import type { ClientCertificate } from 'insomnia/src/models/client-certificate';
import type { RequestHeader } from 'insomnia/src/models/request';
import type { Settings } from 'insomnia/src/models/settings';

import { toPreRequestAuth } from './auth';
import { CookieObject } from './cookies';
import { Environment, Variables } from './environments';
import { Execution } from './execution';
import type { RequestContext } from './interfaces';
import { Request as ScriptRequest, type RequestOptions, toScriptRequestBody } from './request';
import { RequestInfo } from './request-info';
import { Response as ScriptResponse } from './response';
import { readBodyFromPath, toScriptResponse } from './response';
import { sendRequest } from './send-request';
import { type RequestTestResult, skip, test, type TestHandler } from './test';
import { toUrlObject } from './urls';

export class InsomniaObject {
    public environment: Environment;
    public collectionVariables: Environment;
    public baseEnvironment: Environment;
    public variables: Variables;
    public request: ScriptRequest;
    public cookies: CookieObject;
    public info: RequestInfo;
    public response?: ScriptResponse;
    public execution: Execution;

    private clientCertificates: ClientCertificate[];
    private _expect = expect;
    private _test = test;
    private _skip = skip;

    private iterationData: Environment;
    // TODO: follows will be enabled after Insomnia supports them
    private globals: Environment;
    private _settings: Settings;

    private requestTestResults: RequestTestResult[];

    constructor(
        rawObj: {
            globals: Environment;
            iterationData: Environment;
            environment: Environment;
            baseEnvironment: Environment;
            variables: Variables;
            request: ScriptRequest;
            settings: Settings;
            clientCertificates: ClientCertificate[];
            cookies: CookieObject;
            requestInfo: RequestInfo;
            execution: Execution;
            response?: ScriptResponse;
        },
    ) {
        this.globals = rawObj.globals;
        this.environment = rawObj.environment;
        this.baseEnvironment = rawObj.baseEnvironment;
        this.collectionVariables = this.baseEnvironment; // collectionVariables is mapped to baseEnvironment
        this.iterationData = rawObj.iterationData;
        this.variables = rawObj.variables;
        this.cookies = rawObj.cookies;
        this.response = rawObj.response;
        this.execution = rawObj.execution;

        this.info = rawObj.requestInfo;
        this.request = rawObj.request;
        this._settings = rawObj.settings;
        this.clientCertificates = rawObj.clientCertificates;

        this.requestTestResults = new Array<RequestTestResult>();
    }

    sendRequest(
        request: string | ScriptRequest,
        cb: (error?: string, response?: ScriptResponse) => void
    ) {
        return sendRequest(request, cb, this._settings);
    }

    get test() {
        const testHandler: TestHandler = (msg: string, fn: () => void) => {
            this._test(msg, fn, this.pushRequestTestResult);
        };
        testHandler.skip = (msg: string, fn: () => void) => {
            this._skip(msg, fn, this.pushRequestTestResult);
        };

        return testHandler;
    }

    private pushRequestTestResult = (testResult: RequestTestResult) => {
        this.requestTestResults = [...this.requestTestResults, testResult];
    };

    expect(exp: boolean | number | string | object) {
        return this._expect(exp);
    }

    // TODO: remove this after enabled iterationData
    get settings() {
        return undefined;
    }

    toObject = () => {
        return {
            globals: this.globals.toObject(),
            environment: this.environment.toObject(),
            baseEnvironment: this.baseEnvironment.toObject(),
            iterationData: this.iterationData.toObject(),
            variables: this.variables.toObject(),
            request: this.request,
            settings: this.settings,
            clientCertificates: this.clientCertificates,
            cookieJar: this.cookies.jar().toInsomniaCookieJar(),
            info: this.info.toObject(),
            response: this.response ? this.response.toObject() : undefined,
            requestTestResults: this.requestTestResults,
            execution: this.execution.toObject(),
        };
    };
}

export async function initInsomniaObject(
    rawObj: RequestContext,
    log: (...args: any[]) => void,
) {
    // Mapping rule for the global environment:
    // - when one global environment is selected, `globals` points to the selected one
    // Potential mapping rule for the future:
    // - The base global environment could also be introduced
    const globals = new Environment('globals', rawObj.globals || {}); // could be undefined
    // Mapping rule for the environment and base environment:
    // - If base environment is selected, both `baseEnvironment` and `environment` point to the selected one.
    // - If one sub environment is selected,  `baseEnvironment` points to the base env and `environment` points to the selected one.
    const baseEnvironment = new Environment(rawObj.baseEnvironment.name || '', rawObj.baseEnvironment.data);
    // reuse baseEnvironment when the "selected envrionment" points to the base environment
    const environment = rawObj.baseEnvironment.id === rawObj.environment.id ?
        baseEnvironment :
        new Environment(rawObj.environment.name || '', rawObj.environment.data);
    if (rawObj.baseEnvironment.id === rawObj.environment.id) {
        log('warning: No environment is selected, modification of insomnia.environment will be applied to the base environment.');
    }
    // Mapping rule for the environment user uploaded in collection runner
    const iterationData = rawObj.iterationData ?
        new Environment(rawObj.iterationData.name, rawObj.iterationData.data) : new Environment('iterationData', {});
    const cookies = new CookieObject(rawObj.cookieJar);
    // TODO: update follows when post-request script and iterationData are introduced
    const requestInfo = new RequestInfo({
        eventName: rawObj.requestInfo.eventName || 'prerequest',
        iteration: rawObj.requestInfo.iteration || 1,
        iterationCount: rawObj.requestInfo.iterationCount || 0,
        requestName: rawObj.request.name,
        requestId: rawObj.request._id,
    });

    const variables = new Variables({
        globalVars: globals,
        environmentVars: environment,
        collectionVars: baseEnvironment,
        iterationDataVars: iterationData,
    });

    const existClientCert = rawObj.clientCertificates != null && rawObj.clientCertificates.length > 0;
    const certificate = existClientCert && rawObj.clientCertificates[0] ?
        {
            disabled: rawObj.clientCertificates[0].disabled,
            name: 'The first certificate from Settings',
            matches: [rawObj.clientCertificates[0].host],
            key: { src: rawObj.clientCertificates[0].key || '' },
            cert: { src: rawObj.clientCertificates[0].cert || '' },
            passphrase: rawObj.clientCertificates[0].passphrase || undefined,
            pfx: { src: rawObj.clientCertificates[0].pfx || '' }, // PFX or PKCS12 Certificate
        } :
        { disabled: true };

    const bestProxy = rawObj.settings.httpsProxy || rawObj.settings.httpProxy;
    const enabledProxy = rawObj.settings.proxyEnabled && bestProxy !== '';
    const bypassProxyList = rawObj.settings.noProxy ?
        rawObj.settings.noProxy
            .split(',')
            .map(urlStr => urlStr.trim()) :
        [];
    const proxy = {
        disabled: !enabledProxy,
        match: '<all_urls>',
        bypass: bypassProxyList,
        host: '',
        port: 0,
        tunnel: false,
        authenticate: false,
        username: '',
        password: '',
    };
    if (bestProxy !== '') {
        const portStartPos = bestProxy.indexOf(':');
        if (portStartPos > 0) {
            proxy.host = bestProxy.slice(0, portStartPos);
            const port = bestProxy.slice(portStartPos + 1);
            try {
                proxy.port = parseInt(port);
            } catch (e) {
                throw Error(`Invalid proxy port: ${bestProxy}`);
            }
        } else {
            proxy.host = bestProxy;
            proxy.port = 0;
        }
    }

    const reqUrl = toUrlObject(rawObj.request.url);
    reqUrl.addQueryParams(
        rawObj.request.parameters
            .filter(param => !param.disabled)
            .map(param => ({ key: param.name, value: param.value }))
    );

    const reqOpt: RequestOptions = {
        name: rawObj.request.name,
        url: reqUrl,
        method: rawObj.request.method,
        header: rawObj.request.headers.map(
            (header: RequestHeader) => ({ key: header.name, value: header.value, disabled: header.disabled })
        ),
        body: toScriptRequestBody(rawObj.request.body),
        auth: toPreRequestAuth(rawObj.request.authentication),
        proxy,
        certificate,
        pathParameters: rawObj.request.pathParameters,
    };
    const request = new ScriptRequest(reqOpt);
    const execution = new Execution({
        location: rawObj.execution.location,
        skipRequest: rawObj.execution.skipRequest,
        nextRequestIdOrName: rawObj.execution.nextRequestIdOrName,
    });

    const responseBody = await readBodyFromPath(rawObj.response);
    const response = rawObj.response ? toScriptResponse(request, rawObj.response, responseBody) : undefined;

    return new InsomniaObject({
        globals,
        environment,
        baseEnvironment,
        iterationData,
        variables,
        request,
        settings: rawObj.settings,
        clientCertificates: rawObj.clientCertificates,
        cookies,
        requestInfo,
        response,
        execution,
    });
};

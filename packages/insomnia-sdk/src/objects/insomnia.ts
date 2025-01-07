import { expect } from 'chai';
import type { ClientCertificate } from 'insomnia/src/models/client-certificate';
import type { RequestHeader } from 'insomnia/src/models/request';
import type { Settings } from 'insomnia/src/models/settings';
import { filterClientCertificates } from 'insomnia/src/network/certificate';

import { toPreRequestAuth } from './auth';
import { CookieObject } from './cookies';
import { Environment, Variables } from './environments';
import { Execution } from './execution';
import type { RequestContext } from './interfaces';
import { transformToSdkProxyOptions } from './proxy-configs';
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
        const testHandler: TestHandler = async (msg: string, fn: () => Promise<void>) => {
            await this._test(msg, fn, this.pushRequestTestResult);
        };
        testHandler.skip = async (msg: string, fn: () => Promise<void>) => {
            await this._skip(msg, fn, this.pushRequestTestResult);
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
            variables: this.variables.localVarsToObject(),
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
    const localVariables = rawObj.transientVariables ?
        new Environment(rawObj.transientVariables.name, rawObj.transientVariables.data) : new Environment('transientVariables', {});
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
        localVars: localVariables,
    });

    // replace all variables in the raw URL before parsing it
    const sanitizedRawUrl = `${rawObj.request.url}`.replace(/{{\s*\_\./g, '{{');
    const renderedRawUrl = variables.replaceIn(sanitizedRawUrl);

    // parse the URL to get the host + protocol
    const renderedUrl = toUrlObject(renderedRawUrl);

    // filter client certificates by the rendered base URL
    const renderedBaseUrl = toUrlObject(`${renderedUrl.protocol || 'http:'}//${renderedUrl.getHost()}`);
    const filteredCerts = filterClientCertificates(rawObj.clientCertificates || [], renderedBaseUrl.toString());
    const existingClientCert = filteredCerts != null && filteredCerts.length > 0 && filteredCerts[0];
    const certificate = existingClientCert ?
        {
            disabled: existingClientCert.disabled,
            name: 'The first certificate from Settings',
            matches: [existingClientCert.host],
            key: { src: existingClientCert.key || '' },
            cert: { src: existingClientCert.cert || '' },
            passphrase: existingClientCert.passphrase || undefined,
            pfx: { src: existingClientCert.pfx || '' }, // PFX or PKCS12 Certificate
        } :
        { disabled: true };

    const proxy = transformToSdkProxyOptions(
        rawObj.settings.httpProxy,
        rawObj.settings.httpsProxy,
        rawObj.settings.proxyEnabled,
        rawObj.settings.noProxy,
    );

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

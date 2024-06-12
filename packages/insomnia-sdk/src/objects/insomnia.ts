import { expect } from 'chai';
import { ClientCertificate } from 'insomnia/src/models/client-certificate';
import { RequestHeader } from 'insomnia/src/models/request';
import { Settings } from 'insomnia/src/models/settings';

import { toPreRequestAuth } from './auth';
import { CookieObject } from './cookies';
import { Environment, Variables } from './environments';
import { RequestContext } from './interfaces';
import { unsupportedError } from './properties';
import { Request as ScriptRequest, RequestOptions, toScriptRequestBody } from './request';
import { RequestInfo } from './request-info';
import { Response as ScriptResponse } from './response';
import { readBodyFromPath, toScriptResponse } from './response';
import { sendRequest } from './send-request';
import { test } from './test';
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

    private clientCertificates: ClientCertificate[];
    private _expect = expect;
    private _test = test;

    // TODO: follows will be enabled after Insomnia supports them
    private _globals: Environment;
    private _iterationData: Environment;
    private _settings: Settings;

    private _log: (...msgs: any[]) => void;

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
            response?: ScriptResponse;
        },
        log: (...msgs: any[]) => void,
    ) {
        this._globals = rawObj.globals;
        this.environment = rawObj.environment;
        this.baseEnvironment = rawObj.baseEnvironment;
        this.collectionVariables = this.baseEnvironment; // collectionVariables is mapped to baseEnvironment
        this._iterationData = rawObj.iterationData;
        this.variables = rawObj.variables;
        this.cookies = rawObj.cookies;
        this.response = rawObj.response;

        this.info = rawObj.requestInfo;
        this.request = rawObj.request;
        this._settings = rawObj.settings;
        this.clientCertificates = rawObj.clientCertificates;

        this._log = log;
    }

    sendRequest(
        request: string | ScriptRequest,
        cb: (error?: string, response?: ScriptResponse) => void
    ) {
        return sendRequest(request, cb, this._settings);
    }

    test(msg: string, fn: () => void) {
        this._test(msg, fn, this._log);
    }

    expect(exp: boolean | number | string | object) {
        return this._expect(exp);
    }

    // TODO: remove this after enabled globals
    get globals() {
        throw unsupportedError('globals', 'base environment');
    }

    // TODO: remove this after enabled iterationData
    get iterationData() {
        throw unsupportedError('iterationData', 'environment');
    }

    // TODO: remove this after enabled iterationData
    get settings() {
        return undefined;
    }

    toObject = () => {
        return {
            globals: this._globals.toObject(),
            environment: this.environment.toObject(),
            baseEnvironment: this.baseEnvironment.toObject(),
            iterationData: this._iterationData.toObject(),
            variables: this.variables.toObject(),
            request: this.request,
            settings: this.settings,
            clientCertificates: this.clientCertificates,
            cookieJar: this.cookies.jar().toInsomniaCookieJar(),
            info: this.info.toObject(),
            response: this.response ? this.response.toObject() : undefined,
        };
    };
}

export async function initInsomniaObject(
    rawObj: RequestContext,
    log: (...args: any[]) => void,
) {
    const globals = new Environment('globals', rawObj.globals);
    const baseEnvironment = new Environment(rawObj.baseEnvironmentName || '', rawObj.baseEnvironment);
    // reuse baseEnvironment when the "selected envrionment" points to the base environment
    const environment = rawObj.baseEnvironmentName === rawObj.environmentName ?
        baseEnvironment :
        new Environment(rawObj.environmentName || '', rawObj.environment);
    if (rawObj.baseEnvironmentName === rawObj.environmentName) {
        log('warning: No environment is selected, modification of insomnia.environment will be applied to the base environment.');
    }
    // TODO: update "iterationData" name when it is supported
    const iterationData = new Environment('iterationData', rawObj.iterationData);
    const cookies = new CookieObject(rawObj.cookieJar);
    // TODO: update follows when post-request script and iterating are introduced
    const requestInfo = new RequestInfo({
        eventName: 'prerequest',
        iteration: 1,
        iterationCount: 1,
        requestName: rawObj.request.name,
        requestId: rawObj.request._id,
    });

    const variables = new Variables({
        globalVars: globals,
        environmentVars: environment,
        collectionVars: baseEnvironment,
        iterationDataVars: iterationData,
    });

    const certificate = rawObj.clientCertificates != null && rawObj.clientCertificates.length > 0 ?
        {
            disabled: false,
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
            (header: RequestHeader) => ({ key: header.name, value: header.value })
        ),
        body: toScriptRequestBody(rawObj.request.body),
        auth: toPreRequestAuth(rawObj.request.authentication),
        proxy,
        certificate,
        pathParameters: rawObj.request.pathParameters,
    };
    const request = new ScriptRequest(reqOpt);

    const responseBody = await readBodyFromPath(rawObj.response);
    const response = rawObj.response ? toScriptResponse(request, rawObj.response, responseBody) : undefined;

    return new InsomniaObject(
        {
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
        },
        log,
    );
};

import { expect } from 'chai';

import { ClientCertificate } from '../../models/client-certificate';
import { RequestBodyParameter, RequestHeader } from '../../models/request';
import { Settings } from '../../models/settings';
import { toPreRequestAuth } from './auth';
import { Environment, Variables } from './environments';
import { RequestContext } from './interfaces';
import { unsupportedError } from './properties';
import { Request as ScriptRequest, RequestBodyOptions, RequestOptions } from './request';
import { Response as ScriptResponse } from './response';
import { sendRequest } from './send-request';
import { test } from './test';

export class InsomniaObject {
    public environment: Environment;
    public collectionVariables: Environment;
    public baseEnvironment: Environment;
    public variables: Variables;
    public request: ScriptRequest;
    private clientCertificates: ClientCertificate[];
    private expect = expect;
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
        },
        log: (...msgs: any[]) => void,
    ) {
        this._globals = rawObj.globals;
        this.environment = rawObj.environment;
        this.baseEnvironment = rawObj.baseEnvironment;
        this.collectionVariables = this.baseEnvironment; // collectionVariables is mapped to baseEnvironment
        this._iterationData = rawObj.iterationData;
        this.variables = rawObj.variables;

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
        };
    };
}

export function initInsomniaObject(
    rawObj: RequestContext,
    log: (...args: any[]) => void,
) {
    const globals = new Environment(rawObj.globals);
    const environment = new Environment(rawObj.environment);
    const baseEnvironment = new Environment(rawObj.baseEnvironment);
    const iterationData = new Environment(rawObj.iterationData);
    const collectionVariables = new Environment(rawObj.collectionVariables);

    const variables = new Variables({
        globals,
        environment,
        collection: collectionVariables,
        data: iterationData,
    });

    let reqBodyOpt: RequestBodyOptions = { mode: undefined };
    if (rawObj.request.body.text != null) {
        reqBodyOpt = {
            mode: 'raw',
            raw: rawObj.request.body.text,
        };
    } else if (rawObj.request.body.fileName != null && rawObj.request.body.fileName !== '') {
        reqBodyOpt = {
            mode: 'file',
            file: rawObj.request.body.fileName,
        };
    } else if (rawObj.request.body.params != null) {
        reqBodyOpt = {
            mode: 'urlencoded',
            urlencoded: rawObj.request.body.params.map(
                (param: RequestBodyParameter) => ({ key: param.name, value: param.value })
            ),
        };
    }

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

    const reqOpt: RequestOptions = {
        url: rawObj.request.url,
        method: rawObj.request.method,
        header: rawObj.request.headers.map(
            (header: RequestHeader) => ({ key: header.name, value: header.value })
        ),
        body: reqBodyOpt,
        auth: toPreRequestAuth(rawObj.request.authentication),
        proxy,
        certificate,
    };
    const request = new ScriptRequest(reqOpt);

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
        },
        log,
    );
};

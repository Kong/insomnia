// import * as _ from 'lodash';

import { RequestContext } from './common';
import { Environment, Variables } from './environments';
import { Request as ScriptRequest, RequestBodyOptions, RequestOptions } from './request';
import { Response as ScriptResponse } from './response';
import { HttpSendRequest, toPreRequestAuth } from './send-request';

// TODO: remove these when global environment and iteration data are supported in general
// const globalsEnvName = '__GLOBALS';
// const iterationDataEnvName = '__ITERATION_DATA';

export class InsomniaObject {
    public environment: Environment;
    public collectionVariables: Environment;
    public baseEnvironment: Environment;
    public variables: Variables;
    public request: ScriptRequest;
    private httpRequestSender: HttpSendRequest;
    private globals: Environment;
    private iterationData: Environment;

    constructor(
        rawObj: {
            globals: Environment;
            iterationData: Environment;
            environment: Environment;
            baseEnvironment: Environment;
            variables: Variables;
            request: ScriptRequest;
        },
    ) {
        this.environment = rawObj.environment;
        this.baseEnvironment = rawObj.baseEnvironment;
        this.collectionVariables = this.baseEnvironment; // collectionVariables is mapped to baseEnvironment
        this.variables = rawObj.variables;
        this.request = rawObj.request;
        this.globals = rawObj.globals;
        this.iterationData = rawObj.iterationData;

        // fallback to specific fields in baseEnvironment
        // const workaroundGlobals = this.baseEnvironment.get(globalsEnvName);
        // if (
        //     _.isEqual(this.globals.toObject(), {})
        //     && workaroundGlobals != null
        //     && typeof workaroundGlobals === 'object'
        // ) {
        //     this.globals = new Environment(workaroundGlobals);
        // }
        // const workaroundIterationData = this.baseEnvironment.get(iterationDataEnvName);
        // if (
        //     _.isEqual(this.iterationData.toObject(), {})
        //     && workaroundIterationData != null
        //     && typeof workaroundIterationData === 'object'
        // ) {
        //     this.iterationData = new Environment(workaroundIterationData);
        // }

        this.httpRequestSender = new HttpSendRequest({
            preferredHttpVersion: '',
            maxRedirects: 0,
            proxyEnabled: false,
            timeout: 0,
            validateSSL: false,
            followRedirects: false,
            maxTimelineDataSizeKB: 0,
            httpProxy: '',
            httpsProxy: '',
            noProxy: '',
        });
    }

    sendRequest(
        request: string | ScriptRequest,
        cb: (error?: string, response?: ScriptResponse) => void
    ) {
        return this.httpRequestSender.sendRequest(request, cb);
    }

    toObject = () => {
        // currently, globals and iterationData are not supported in Insomnia
        // so they are rendered here so that they will finally work in rendering
        // remove this part after they are supported in general
        // const flattenedEnv = {
        //     ...this.globals.toObject(),
        //     ...this.baseEnvironment.toObject(),
        //     ...this.environment.toObject(),
        //     ...this.iterationData.toObject(),
        // };

        return {
            globals: this.globals.toObject(),
            // environment: flattenedEnv,
            environment: this.environment.toObject(),
            baseEnvironment: this.baseEnvironment.toObject(),
            iterationData: this.iterationData.toObject(),
            variables: this.variables.toObject(),
            request: this.request,
        };
    };
}

export function initInsomniaObject(
    rawObj: RequestContext,
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
                param => ({ key: param.name, value: param.value })
            ),
        };
    }

    const reqOpt: RequestOptions = {
        url: rawObj.request.url,
        method: rawObj.request.method,
        header: rawObj.request.headers.map(
            header => ({ key: header.name, value: header.value })
        ),
        body: reqBodyOpt,
        auth: toPreRequestAuth(rawObj.request.authentication),
        // proxy: ProxyConfigOptions, from settings
        // certificate: CertificateOptions,
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
        },
    );
};

import { RequestBodyParameter, RequestHeader } from '../../models/request';
import { toPreRequestAuth } from './auth';
import { Environment, Variables } from './environments';
import { RequestContext } from './interfaces';
import { unsupportedError } from './properties';
import { Request as ScriptRequest, RequestBodyOptions, RequestOptions } from './request';

export class InsomniaObject {
    public environment: Environment;
    public collectionVariables: Environment;
    public baseEnvironment: Environment;
    public variables: Variables;
    public request: ScriptRequest;

    // TODO: follows will be enabled after Insomnia supports them
    private _globals: Environment;
    private _iterationData: Environment;

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
        this._globals = rawObj.globals;
        this.environment = rawObj.environment;
        this.baseEnvironment = rawObj.baseEnvironment;
        this.collectionVariables = this.baseEnvironment; // collectionVariables is mapped to baseEnvironment
        this._iterationData = rawObj.iterationData;
        this.variables = rawObj.variables;
        this.request = rawObj.request;
    }

    // TODO: remove this after enabled globals
    get globals() {
        throw unsupportedError('globals', 'base environment');
    }

    // TODO: remove this after enabled iterationData
    get iterationData() {
        throw unsupportedError('iterationData', 'environment');
    }

    toObject = () => {
        return {
            globals: this._globals.toObject(),
            environment: this.environment.toObject(),
            baseEnvironment: this.baseEnvironment.toObject(),
            iterationData: this._iterationData.toObject(),
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
                (param: RequestBodyParameter) => ({ key: param.name, value: param.value })
            ),
        };
    }

    const reqOpt: RequestOptions = {
        url: rawObj.request.url,
        method: rawObj.request.method,
        header: rawObj.request.headers.map(
            (header: RequestHeader) => ({ key: header.name, value: header.value })
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

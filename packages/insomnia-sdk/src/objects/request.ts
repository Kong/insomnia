import { type ClientCertificate, init as initClientCertificate } from 'insomnia/src/models/client-certificate';
import type { Request as InsomniaRequest, RequestBody as InsomniaRequestBody, RequestBodyParameter, RequestPathParameter } from 'insomnia/src/models/request';
import type { Settings } from 'insomnia/src/models/settings';

import { type AuthOptions, type AuthOptionTypes, fromPreRequestAuth, RequestAuth } from './auth';
import type { CertificateOptions } from './certificates';
import { Certificate } from './certificates';
import type { HeaderDefinition } from './headers';
import { Header, HeaderList } from './headers';
import { Property, PropertyBase, PropertyList } from './properties';
import { ProxyConfig, type ProxyConfigOptions } from './proxy-configs';
import { QueryParam, toUrlObject, Url } from './urls';
import { Variable, VariableList } from './variables';

export type RequestBodyMode = undefined | 'formdata' | 'urlencoded' | 'raw' | 'file' | 'graphql';

export interface RequestBodyOptions {
    mode: RequestBodyMode;
    file?: string;
    formdata?: { key: string; value: string; type?: string; disabled?: boolean }[];
    graphql?: { query: string; operationName: string; variables: object; disabled?: boolean };
    raw?: string;
    urlencoded?: { key: string; value: string; type?: string; disabled?: boolean; multiline?: boolean | string; fileName?: string }[];
    options?: object;
}

export class FormParam extends Property {
    key: string;
    value: string;
    type?: string;

    constructor(options: { key: string; value: string; type?: string; disabled?: boolean }) {
        super();
        this.key = options.key;
        this.value = options.value;
        this.type = options.type;
        this.disabled = options.disabled;
    }

    static _postman_propertyAllowsMultipleValues() {
        throw Error('unsupported');
    }

    static _postman_propertyIndexKey() {
        throw Error('unsupported');
    }

    // TODO: it is not supported yet in existing scripts
    // static parse(param: FormParam) {
    // }

    override toJSON() {
        return { key: this.key, value: this.value, type: this.type, disabled: this.disabled };
    }

    override toString() {
        const key = encodeURIComponent(this.key);
        const value = encodeURIComponent(this.value);
        return `${key}=${value}`;
    }

    override valueOf() {
        return this.value;
    }
}

function getClassFields(opts: RequestBodyOptions) {
    const formdata = opts.formdata ?
        new PropertyList(
            FormParam,
            undefined,
            opts.formdata.
                map(formParamObj => new FormParam({
                    ...formParamObj,
                }))
        ) :
        undefined;

    let urlencoded = undefined;
    if (opts.urlencoded != null) {
        if (typeof opts.urlencoded === 'string') {
            const queryParamObj = QueryParam.parse(opts.urlencoded);
            urlencoded = new PropertyList(
                QueryParam,
                undefined,
                Object.entries(queryParamObj)
                    .map(entry => ({ key: entry[0], value: JSON.stringify(entry[1]) }))
                    .map(kv => new QueryParam(kv)),
            );
        } else {
            urlencoded = new PropertyList(
                QueryParam,
                undefined,
                opts.urlencoded
                    .map(entry => ({
                        key: entry.key,
                        value: entry.value,
                        type: entry.type,
                        disabled: entry.disabled,
                        fileName: entry.fileName,
                        multiline: entry.multiline,
                    }))
                    .map(kv => new QueryParam(kv)),
            );
        }
    }

    return {
        mode: opts.mode,
        file: opts.file,
        graphql: opts.graphql,
        raw: opts.raw,
        options: opts.options,
        formdata,
        urlencoded,
    };
}

export class RequestBody extends PropertyBase {
    mode: RequestBodyMode; // type of request data
    // It can be a file path (when used with Node.js) or a unique ID (when used with the browser).
    // or it could be "data:application/octet-stream;base64"
    file?: string;
    formdata?: PropertyList<FormParam>;
    graphql?: { query: string; operationName: string; variables: object }; // raw graphql data
    // TODO: option's usage is unknown
    raw?: string; // raw body
    urlencoded?: PropertyList<QueryParam>; // URL encoded body params
    options?: object; // request body options

    constructor(opts: RequestBodyOptions) {
        super();

        const transformedOpts = getClassFields(opts);
        this.mode = transformedOpts.mode;
        this.file = transformedOpts.file;
        this.formdata = transformedOpts.formdata;
        this.graphql = transformedOpts.graphql;
        this.options = transformedOpts.options;
        this.raw = transformedOpts.raw;
        this.urlencoded = transformedOpts.urlencoded;
    }

    isEmpty() {
        switch (this.mode) {
            case 'formdata':
                return this.formdata == null;
            case 'urlencoded':
                return this.urlencoded == null;
            case 'raw':
                return this.raw == null;
            case 'file':
                return this.file == null;
            case 'graphql':
                return this.graphql == null;
            default:
                throw Error(`isEmpty: mode (${this.mode}) is unexpected`);
        }
    }

    override toString() {
        if (this.mode === undefined) {
            return '';
        }

        try {
            switch (this.mode) {
                case 'formdata':
                    return this.formdata?.map(param => param.toString(), {}).join('&') || '';
                case 'urlencoded':
                    return this.urlencoded?.map(param => param.toString(), {}).join('&') || '';
                case 'raw':
                    return this.raw || '';
                case 'file':
                    return this.file || '';
                case 'graphql':
                    return this.graphql ? JSON.stringify(this.graphql) : '';
                default:
                    throw Error(`mode (${this.mode}) is unexpected`);
            }
        } catch (e) {
            throw Error(`toString: ${e}`);
        }
    }

    update(opts: RequestBodyOptions) {
        const transformedOpts = getClassFields(opts);
        this.mode = transformedOpts.mode;
        this.file = transformedOpts.file;
        this.formdata = transformedOpts.formdata;
        this.graphql = transformedOpts.graphql;
        this.options = transformedOpts.options;
        this.raw = transformedOpts.raw;
        this.urlencoded = transformedOpts.urlencoded;
    }
}

export interface RequestOptions {
    url: string | Url;
    method?: string;
    header?: HeaderDefinition[] | object;
    body?: RequestBodyOptions;
    auth?: AuthOptions;
    proxy?: ProxyConfigOptions;
    certificate?: CertificateOptions;
    pathParameters?: RequestPathParameter[];
    name?: string;
}

export interface RequestSize {
    body: number;
    header: number;
    total: number;
    source: string;
}

function requestOptionsToClassFields(options: RequestOptions) {
    const url = toUrlObject(options.url);
    const method = options.method || 'GET';

    let headers: HeaderList<Header>;
    if (options.header != null) {
        if (Array.isArray(options.header)) {
            headers = new HeaderList(
                undefined,
                options.header ? options.header.map(header => new Header(header)) : [],
            );
        } else {
            headers = new HeaderList(
                undefined,
                Object.entries(options.header)
                    .map(entry => new Header({ key: entry[0], value: entry[1] })),
            );
        }
    } else {
        headers = new HeaderList(undefined, new Array<Header>());
    }

    const body = options.body ? new RequestBody(options.body) : undefined;
    const auth = new RequestAuth(options.auth || { type: 'noauth' });
    const proxy = options.proxy ? new ProxyConfig(options.proxy) : undefined;
    const certificate = options.certificate ? new Certificate(options.certificate) : undefined;
    const pathParameters = options.pathParameters ? options.pathParameters : new Array<RequestPathParameter>();

    return {
        name: options.name || '',
        url,
        method,
        headers,
        body,
        auth,
        proxy,
        certificate,
        pathParameters,
    };
}

export class Request extends Property {
    override name: string;
    url: Url;
    method: string;
    headers: HeaderList<Header>;
    body?: RequestBody;
    auth: RequestAuth;
    proxy?: ProxyConfig;
    certificate?: Certificate;
    pathParameters: RequestPathParameter[];

    constructor(options: RequestOptions) {
        super();

        this._kind = 'Request';

        const transformedOpts = requestOptionsToClassFields(options);

        this.name = transformedOpts.name;
        this.url = transformedOpts.url;
        this.method = transformedOpts.method;
        this.headers = transformedOpts.headers;
        this.body = transformedOpts.body;
        this.auth = transformedOpts.auth;
        this.proxy = transformedOpts.proxy;
        this.certificate = transformedOpts.certificate;
        this.pathParameters = transformedOpts.pathParameters;
    }

    static isRequest(obj: object) {
        return '_kind' in obj && obj._kind === 'Request';
    }

    addHeader(header: Header | object) {
        if (Header.isHeader(header)) {
            const headerInstance = header as Header;
            this.headers.add(headerInstance);
        } else if ('key' in header && 'value' in header) {
            const headerInstance = new Header(header);
            this.headers.add(headerInstance);
        } else {
            throw Error('header must be Header | {key: string; value: string}');
        }
    }

    addQueryParams(params: QueryParam[] | string) {
        this.url.addQueryParams(params);
    }

    authorizeUsing(authType: AuthOptionTypes | AuthOptions, options?: VariableList<Variable>) {
        const selectedAuth = typeof authType === 'string' ? authType : authType.type;
        this.auth.use(selectedAuth, options || { type: 'noauth' });
    }

    clone() {
        return new Request({ ...this.toJSON() });
    }

    forEachHeader(callback: (header: Header, context?: object) => void) {
        this.headers.each(callback, {});
    }

    getHeaders(options?: {
        ignoreCase: boolean;
        enabled: boolean;
        multiValue: boolean;
        sanitizeKeys: boolean;
    }) {
        // merge headers with same key into an array
        const headerMap = new Map<string, string[]>();
        this.headers.each(header => {
            // if the disable is null, it means enabled.
            const enabled = options?.enabled ? header.disabled == null || !header.disabled : true;
            const isFalsyValue = options?.sanitizeKeys ? !header.value : false;
            const hasName = !!header.key;

            if (!enabled || isFalsyValue || !hasName) {
                return;
            }

            header.key = options?.ignoreCase ? header.key?.toLocaleLowerCase() : header.key;

            if (headerMap.has(header.key)) {
                const existingHeader = headerMap.get(header.key) || [];
                headerMap.set(header.key, [...existingHeader, header.value]);
            } else {
                headerMap.set(header.key, [header.value]);
            }
        }, {});

        const headersObj: Record<string, string[] | string> = {};
        Array.from(headerMap.entries())
            .forEach(headerEntry => {
                headersObj[headerEntry[0]] = headerEntry[1];
            });

        return headersObj;
    }

    removeHeader(toRemove: string | Header, options?: { ignoreCase: boolean }) {
        const filteredHeaders = this.headers.filter(
            header => {
                if (!header.key) {
                    return false;
                }

                if (typeof toRemove === 'string') {
                    return options != null && options.ignoreCase ?
                        header.key.toLocaleLowerCase() !== toRemove.toLocaleLowerCase() :
                        header.key !== toRemove;
                } else if (toRemove instanceof Header) {
                    if (!toRemove.key) {
                        return false;
                    }

                    return options != null && options.ignoreCase ?
                        header.key.toLocaleLowerCase() !== toRemove.key.toLocaleLowerCase() :
                        header.key !== toRemove.key;
                } else {
                    throw Error('type of the "toRemove" must be: string | Header');
                }
            },
            {},
        );

        this.headers = new HeaderList(undefined, filteredHeaders);
    }

    removeQueryParams(params: string | string[] | QueryParam[]) {
        this.url.removeQueryParams(params);
    }

    size(): RequestSize {
        return calculateRequestSize(this.body, this.headers);
    }

    override toJSON() {
        return {
            url: this.url,
            method: this.method,
            header: this.headers.map(header => header.toJSON(), {}),
            body: {
                mode: this.body?.mode,
                file: this.body?.file,
                formdata: this.body?.formdata?.map(formParam => formParam.toJSON(), {}),
                graphql: this.body?.graphql,
                raw: this.body?.raw,
                urlencoded: this.body?.urlencoded?.map(queryParam => queryParam.toJSON(), {}),
            },
            auth: this.auth.toJSON(),
            proxy: this.proxy ? {
                match: this.proxy.match,
                host: this.proxy.host,
                port: this.proxy.port,
                tunnel: this.proxy.tunnel,
                disabled: this.proxy.disabled,
                authenticate: this.proxy.authenticate,
                username: this.proxy.username,
                password: this.proxy.password,
                protocol: this.proxy.protocol,
            } : undefined,
            certificate: this.certificate ? {
                name: this.certificate?.name,
                matches: this.certificate?.matches?.map(match => match.toString(), {}),
                key: this.certificate?.key,
                cert: this.certificate?.cert,
                passphrase: this.certificate?.passphrase,
                pfx: this.certificate?.pfx,
            } : undefined,
        };
    }

    update(options: RequestOptions) {
        const transformedOptions = requestOptionsToClassFields(options);

        this.name = transformedOptions.name;
        this.url = transformedOptions.url;
        this.method = transformedOptions.method;
        this.headers = transformedOptions.headers;
        this.body = transformedOptions.body;
        this.auth = transformedOptions.auth;
        this.proxy = transformedOptions.proxy;
        this.certificate = transformedOptions.certificate;
        this.pathParameters = transformedOptions.pathParameters;
    }

    upsertHeader(header: HeaderDefinition) {
        // remove keys with same name
        this.headers = new HeaderList(
            undefined,
            this.headers
                .filter(
                    existingHeader => existingHeader.key !== header.key,
                    {},
                )
        );

        // append new
        this.headers.append(new Header(header));
    }
}

export function mergeSettings(
    originalSettings: Settings,
    updatedReq: Request,
): Settings {
    const proxyEnabled = updatedReq.proxy != null
        && !updatedReq.proxy.disabled
        && updatedReq.proxy.getProxyUrl() !== '';
    if (!proxyEnabled) {
        return originalSettings;
    }

    const proxyUrl = updatedReq.proxy?.getProxyUrl();
    if (!proxyUrl) {
        return originalSettings;
    }

    // it always override both http and https proxies
    const httpProxy = proxyUrl;
    const httpsProxy = proxyUrl;

    return {
        ...originalSettings,
        proxyEnabled,
        httpProxy,
        httpsProxy,
    };
}

export function mergeClientCertificates(
    originalClientCertificates: ClientCertificate[],
    updatedReq: Request,
): ClientCertificate[] {
    // as Pre-request script request only supports one certificate while Insomnia supports configuring multiple ones
    // then the mapping rule is:
    // - if the pre-request script request cert is specified, it replaces all original certs
    // - if not, it returns original certs

    if (!updatedReq.certificate) {
        return originalClientCertificates;
    } else if (
        updatedReq.certificate.key == null &&
        updatedReq.certificate.cert == null &&
        updatedReq.certificate.pfx == null
    ) {
        return originalClientCertificates;
    }

    const baseCertificate = originalClientCertificates && originalClientCertificates.length > 0 ?
        {
            // TODO: remove baseModelPart currently it is necessary for type checking
            ...initClientCertificate(),
            ...originalClientCertificates[0],
        } :
        {
            // TODO: remove baseModelPart currently it is necessary for type checking
            ...initClientCertificate(),
            _id: '',
            type: '',
            parentId: '',
            modified: 0,
            created: 0,
            isPrivate: false,
            name: '',
        };

    if (updatedReq.certificate.pfx && updatedReq.certificate.pfx?.src !== '') {
        const specifiedCert: ClientCertificate = {
            ...baseCertificate,
            key: null,
            cert: null,
            name: updatedReq.certificate.name || '',
            disabled: updatedReq.certificate.disabled || false,
            passphrase: updatedReq.certificate.passphrase || null,
            pfx: updatedReq.certificate.pfx?.src,
            host: '*',
        };

        return [specifiedCert, ...originalClientCertificates];
    } else if (
        updatedReq &&
        updatedReq.certificate.key &&
        updatedReq.certificate.cert &&
        updatedReq.certificate.key?.src !== '' &&
        updatedReq.certificate.cert?.src !== ''
    ) {
        const specifiedCert: ClientCertificate = {
            ...baseCertificate,

            _id: '',
            type: '',
            parentId: '',
            modified: 0,
            created: 0,
            isPrivate: false,
            name: updatedReq.certificate.name || '',
            disabled: updatedReq.certificate.disabled || false,
            host: '*',
            key: updatedReq.certificate.key?.src,
            cert: updatedReq.certificate.cert?.src,
            passphrase: updatedReq.certificate.passphrase || null,
            pfx: null,
        };

        return [specifiedCert, ...originalClientCertificates];
    }

    throw Error('Invalid certificate configuration: "cert+key" and "pfx" can not be set at the same time');
}

export function toScriptRequestBody(insomniaReqBody: InsomniaRequestBody): RequestBodyOptions {
    let reqBodyOpt: RequestBodyOptions = { mode: undefined };

    if (insomniaReqBody.text !== undefined) {
        reqBodyOpt = {
            mode: 'raw',
            raw: insomniaReqBody.text,
        };
    } else if (insomniaReqBody.fileName !== undefined && insomniaReqBody.fileName !== '') {
        reqBodyOpt = {
            mode: 'file',
            file: insomniaReqBody.fileName,
        };
    } else if (insomniaReqBody.params !== undefined) {
        reqBodyOpt = {
            mode: 'urlencoded',
            urlencoded: insomniaReqBody.params.map(
                (param: RequestBodyParameter) => ({
                    key: param.name,
                    value: param.value,
                    type: param.type,
                    multiline: param.multiline,
                    disabled: param.disabled,
                    fileName: param.fileName,
                })
            ),
        };
    }

    return reqBodyOpt;
}

export function mergeRequestBody(
    updatedReqBody: RequestBody | undefined,
    originalReqBody: InsomniaRequestBody
): InsomniaRequestBody {
    let mimeType = 'application/octet-stream';
    if (updatedReqBody) {
        switch (updatedReqBody.mode) {
            case undefined:
                mimeType = 'application/octet-stream';
                break;
            case 'raw':
                mimeType = 'text/plain';
                break;
            case 'file':
                // TODO: improve this by sniffing
                mimeType = 'application/octet-stream';
                break;
            case 'formdata':
                // boundary should already be part of Content-Type header
                mimeType = 'multipart/form-data';
                break;
            case 'urlencoded':
                mimeType = 'application/x-www-form-urlencoded';
                break;
            case 'graphql':
                mimeType = 'application/json';
                break;
            default:
                throw Error(`unknown request body mode: ${updatedReqBody.mode}`);
        }
    }
    if (originalReqBody.mimeType) {
        mimeType = originalReqBody.mimeType;
    }

    try {
        const textContent = updatedReqBody?.raw !== undefined ? updatedReqBody?.raw :
            updatedReqBody?.graphql ? JSON.stringify(updatedReqBody?.graphql) : undefined;

        return {
            mimeType: mimeType,
            text: textContent,
            fileName: updatedReqBody?.file,
            params: updatedReqBody?.urlencoded?.map(
                (param: QueryParam) => {
                    return {
                        name: param.key,
                        value: param.value,
                        type: param.type,
                        fileName: param.fileName,
                        multiline: param.multiline,
                        disabled: param.disabled,
                    };
                },
                {},
            ),
        };
    } catch (e) {
        throw Error(`failed to update body: ${e}`);
    }
}

export function mergeRequests(
    originalReq: InsomniaRequest,
    updatedReq: Request
): InsomniaRequest {
    const updatedReqProperties: Partial<InsomniaRequest> = {
        name: updatedReq.name,
        url: updatedReq.url.toString(),
        method: updatedReq.method,
        body: mergeRequestBody(updatedReq.body, originalReq.body),
        headers: updatedReq.headers
            .map(
                (header: Header) => ({
                    name: header.key,
                    value: header.value,
                    disabled: header.disabled,
                }),
            {},
        ),
        authentication: fromPreRequestAuth(updatedReq.auth),
        preRequestScript: '',
        pathParameters: updatedReq.pathParameters,
        parameters: [], // set empty array as parameters will be part of url field
    };

    return {
        ...originalReq,
        ...updatedReqProperties,
    };
}

export function calculateRequestSize(body: RequestBody | undefined, headers: HeaderList<Header>): RequestSize {
    const bodySize = new Blob([(body || '').toString()]).size;
    const headerSize = new Blob([
        headers.reduce(
            (acc, header) => (acc + header.toString() + '\n'),
            '',
            {},
        ),
    ]).size;

    return {
        body: bodySize,
        header: headerSize,
        total: bodySize + headerSize,
        source: 'COMPUTED',
    };
}

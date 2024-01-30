import { Cookie } from 'tough-cookie';
import { v4 as uuidv4 } from 'uuid';

// import { getSetCookieHeaders } from '../../../../src/common/misc';
// import {
//     // AUTH_API_KEY,
//     AUTH_ASAP,
//     AUTH_AWS_IAM,
//     AUTH_BASIC,
//     // AUTH_BEARER,
//     AUTH_DIGEST,
//     AUTH_HAWK,
//     AUTH_NETRC,
//     AUTH_NONE,
//     AUTH_NTLM,
//     AUTH_OAUTH_1,
//     AUTH_OAUTH_2,
//     // HAWK_ALGORITHM_SHA1,
//     // HAWK_ALGORITHM_SHA256,
// } from '../../../common/constants';
// import type { CurlRequestOptions, CurlRequestOutput } from '../../../main/network/libcurl-promise';
// import { newAuth } from '../../../models/request';
// import { ResponseHeader } from '../../../models/response';
import { cancellablePromise, deleteCancelRequestFunctionMap, setCancelRequestFunctionMap } from '../../../network/cancellation';
import { RequestAuth } from './auth';
import { Settings } from './common';
import { CookieOptions } from './cookies';
import { Request, Response } from './req-resp';

export const AUTH_NONE = 'none';
export const AUTH_API_KEY = 'apikey';
export const AUTH_OAUTH_2 = 'oauth2';
export const AUTH_OAUTH_1 = 'oauth1';
export const AUTH_BASIC = 'basic';
export const AUTH_DIGEST = 'digest';
export const AUTH_BEARER = 'bearer';
export const AUTH_NTLM = 'ntlm';
export const AUTH_HAWK = 'hawk';
export const AUTH_AWS_IAM = 'iam';
export const AUTH_NETRC = 'netrc';
export const AUTH_ASAP = 'asap';
export const HAWK_ALGORITHM_SHA256 = 'sha256';
export const HAWK_ALGORITHM_SHA1 = 'sha1';

export enum CurlInfoDebug {
    Text,
    HeaderIn,
    HeaderOut,
    DataIn,
    DataOut,
    SslDataIn,
    SslDataOut,
}

interface ResponseHeader {
    name: string;
    value: string;
}

export interface ResponsePatch {
    bodyCompression?: 'zip' | null;
    bodyPath?: string;
    bytesContent?: number;
    bytesRead?: number;
    contentType?: string;
    elapsedTime: number;
    environmentId?: string | null;
    error?: string;
    headers?: ResponseHeader[];
    httpVersion?: string;
    message?: string;
    parentId?: string;
    settingSendCookies?: boolean;
    settingStoreCookies?: boolean;
    statusCode?: number;
    statusMessage?: string;
    timelinePath?: string;
    url?: string;
}

export interface HeaderResult {
    headers: ResponseHeader[];
    version: string;
    code: number;
    reason: string;
}

export interface ResponseTimelineEntry {
    name: keyof typeof CurlInfoDebug;
    timestamp: number;
    value: string;
}

interface CurlRequestOutput {
    patch: ResponsePatch;
    debugTimeline: ResponseTimelineEntry[];
    headerResults: HeaderResult[];
    responseBodyPath?: string;
}

export function transformAuth(type: string, oldAuth: Record<string, any> = {}): Record<string, any> {
    switch (type) {
        // No Auth
        case AUTH_NONE:
            return {};

        // HTTP Basic Authentication
        case AUTH_BASIC:
            return {
                type,
                useISO88591: oldAuth.useISO88591 || false,
                disabled: oldAuth.disabled || false,
                username: oldAuth.username || '',
                password: oldAuth.password || '',
            };

        case AUTH_DIGEST:
        case AUTH_NTLM:
            return {
                type,
                disabled: oldAuth.disabled || false,
                username: oldAuth.username || '',
                password: oldAuth.password || '',
            };

        case AUTH_OAUTH_1:
            return {
                type,
                disabled: false,
                signatureMethod: 'HMAC-SHA1',
                consumerKey: '',
                consumerSecret: '',
                tokenKey: '',
                tokenSecret: '',
                privateKey: '',
                version: '1.0',
                nonce: '',
                timestamp: '',
                callback: '',
            };

        // OAuth 2.0
        case AUTH_OAUTH_2:
            return {
                type,
                grantType: 'authorization_code',
            };

        // Aws IAM
        case AUTH_AWS_IAM:
            return {
                type,
                disabled: oldAuth.disabled || false,
                accessKeyId: oldAuth.accessKeyId || '',
                secretAccessKey: oldAuth.secretAccessKey || '',
                sessionToken: oldAuth.sessionToken || '',
            };

        // Hawk
        case AUTH_HAWK:
            return {
                type,
                algorithm: HAWK_ALGORITHM_SHA256,
            };

        // Atlassian ASAP
        case AUTH_ASAP:
            return {
                type,
                issuer: '',
                subject: '',
                audience: '',
                additionalClaims: '',
                keyId: '',
                privateKey: '',
            };

        // Types needing no defaults
        case AUTH_NETRC:
        default:
            return {
                type,
            };
    }
}

function transformAuthentication(auth: RequestAuth) {
    const authObj = auth.toJSON();
    const findValueInObj = (targetKey: string, kvs?: { key: string; value: string }[]) => {
        if (!kvs) {
            return '';
        }

        return kvs.reduce(
            (
                finalValue: string | undefined,
                kv: { key: string; value: string }
            ) => finalValue = kv.key === targetKey ? kv.value : '',
            '',
        );
    };

    switch (authObj.type) {
        case 'noauth':
            return transformAuth(AUTH_NONE, {});
        // TODO: these 2 methods are not supported yet
        // case 'apikey':
        // case 'bearer':
        //     // TODO: need double check
        //     return {
        //         type: AUTH_BEARER,
        //         disabled: false,
        //         token: findValueInObj('token', authObj.bearer),
        //     };
        case 'basic':
            return transformAuth(
                AUTH_BASIC,
                {
                    useISO88591: false,
                    disabled: false,
                    username: findValueInObj('username', authObj.basic),
                    password: findValueInObj('password', authObj.basic),
                }
            );
        case 'digest':
            return transformAuth(
                AUTH_DIGEST,
                {
                    disabled: false,
                    username: findValueInObj('username', authObj.digest),
                    password: findValueInObj('password', authObj.digest),
                }
            );
        case 'ntlm':
            return transformAuth(
                AUTH_NTLM,
                {
                    disabled: false,
                    username: findValueInObj('username', authObj.ntlm),
                    password: findValueInObj('password', authObj.ntlm),
                }
            );
        case 'oauth1':
            return transformAuth(
                AUTH_OAUTH_1,
                {
                    disabled: false,
                    consumerKey: findValueInObj('consumerKey', authObj.oauth1),
                    consumerSecret: findValueInObj('consumerSecret', authObj.oauth1),
                    tokenKey: findValueInObj('token', authObj.oauth1),
                    tokenSecret: findValueInObj('tokenSecret', authObj.oauth1),
                    privateKey: findValueInObj('consumerSecret', authObj.oauth1),
                    version: findValueInObj('version', authObj.oauth1),
                    nonce: findValueInObj('nonce', authObj.oauth1),
                    timestamp: findValueInObj('timestamp', authObj.oauth1),
                    callback: findValueInObj('callback', authObj.oauth1),
                }
            );
        case 'oauth2':
            return transformAuth(AUTH_OAUTH_2, {});
        case 'awsv4':
            return transformAuth(
                AUTH_AWS_IAM,
                {
                    disabled: false,
                    accessKeyId: findValueInObj('accessKey', authObj.awsv4),
                    secretAccessKey: findValueInObj('secretKey', authObj.awsv4),
                    sessionToken: findValueInObj('sessionToken', authObj.awsv4),
                }
            );
        case 'hawk':
            return transformAuth(AUTH_HAWK, {});
        case 'asap':
            return transformAuth(
                AUTH_ASAP,
                {
                    // exp: string; // expiry
                    // claims: string; // e.g., { "additional claim": "claim value" }
                    // sub: string; // subject
                    // privateKey: string; // private key
                    // kid: string; // key id
                    // aud: string; // audience
                    // iss: string; // issuer
                    // alg: string; // e.g., RS256
                    // id: string;
                    issuer: findValueInObj('iss', authObj.asap),
                    subject: findValueInObj('sub', authObj.asap),
                    audience: findValueInObj('aud', authObj.asap),
                    additionalClaims: findValueInObj('claims', authObj.asap),
                    keyId: findValueInObj('kid', authObj.asap),
                    privateKey: findValueInObj('privateKey', authObj.asap),
                }
            );
        case 'netrc':
            return transformAuth(AUTH_NETRC, {});
        default:
            throw Error(`unknown auth type: ${authObj.type}`);
    }
}

export class HttpSendRequest {
    constructor(private settings: Settings) { }

    sendRequest(
        request: string | Request,
        cb: (error?: string, response?: Response) => void
    ) {
        const requestOptions = fromRequestToCurlOptions(request, this.settings);

        const controller = new AbortController();
        const cancelRequest = () => {
            window.main.cancelCurlRequest(requestOptions.requestId);
            controller.abort();
        };
        setCancelRequestFunctionMap(requestOptions.requestId, cancelRequest);

        try {
            cancellablePromise({
                signal: controller.signal,
                fn: window.main.curlRequest(requestOptions),
            }).then(result => {
                const output = result as CurlRequestOutput;
                return fromCurlOutputToResponse(output);
            }).then(transformedOutput => {
                cb(undefined, transformedOutput);
            }).catch(e => {
                cb(e, undefined);
            });
        } catch (err) {
            deleteCancelRequestFunctionMap(requestOptions.requestId);
            if (err.name === 'AbortError') {
                cb(`Request was cancelled: ${err.message}`, undefined);
                return;
            }
            cb(`Something went wrong: ${err.message}`, undefined);
        }

    }
}

// function fromRequestToCurlOptions(req: string | Request, settings: Settings): CurlRequestOptions {
function fromRequestToCurlOptions(req: string | Request, settings: Settings) {
    const id = uuidv4();

    if (typeof req === 'string') {
        return {
            requestId: `pre-request-script-adhoc-str-req:${id}`,
            req: {
                headers: [],
                method: 'GET',
                body: { mimeType: undefined }, // TODO: use value from headers
                authentication: transformAuthentication(
                    new RequestAuth({ type: 'noauth' }),
                ),
                settingFollowRedirects: settings.followRedirects ? 'on' : 'off',
                settingRebuildPath: true,
                settingSendCookies: true,
                url: req,
                cookieJar: {
                    cookies: [],
                },
                cookies: [],
                suppressUserAgent: false,
            },
            finalUrl: req,
            settings,
            certificates: [],
            caCertficatePath: null,
            socketPath: undefined,
            authHeader: undefined, // it seems not used
        };
    } else if (req instanceof Request) {
        return {
            requestId: req.id || `pre-request-script-adhoc-req:${id}`,
            req: {
                headers: req.headers.map(header => ({ name: header.key, value: header.value }), {}),
                method: 'GET',
                body: { mimeType: undefined }, // TODO: use value from headers
                authentication: transformAuthentication(req.auth),
                settingFollowRedirects: settings.followRedirects ? 'on' : 'off',
                settingRebuildPath: true,
                settingSendCookies: true,
                url: req.url.toString(),
                cookieJar: {
                    cookies: [],
                },
                cookies: [], // no cookie can be set in the arg Request
                suppressUserAgent: req.headers.map(
                    h => h.key.toLowerCase() === 'user-agent' && h.disabled === true,
                    {},
                ).length > 0,
            },
            finalUrl: req.url.toString(),
            settings,
            certificates: req.certificate ?
                [{
                    host: req.certificate?.name || '',
                    passphrase: req.certificate?.passphrase || '',
                    cert: req.certificate?.cert?.src || '',
                    key: req.certificate?.key?.src || '',
                    pfx: req.certificate?.pfx?.src || '',
                    // unused fields because they are not persisted
                    disabled: false,
                    isPrivate: false,
                    _id: '',
                    type: '',
                    parentId: '',
                    modified: 0,
                    created: 0,
                    name: '',
                }] :
                [],
            caCertficatePath: null, // the arg request doesn't support ca yet
            socketPath: undefined,
            authHeader: undefined, // it seems not used
        };
    }

    throw Error('the request type must be: string | Request.');
}

async function fromCurlOutputToResponse(result: CurlRequestOutput): Response {
    // input
    // patch: ResponsePatch;
    // export interface ResponsePatch {
    //     bodyCompression?: 'zip' | null;
    //     bodyPath?: string;
    //     bytesContent?: number;
    //     bytesRead?: number;
    //     contentType?: string;
    //     elapsedTime: number;
    //     environmentId?: string | null;
    //     error?: string;
    //     headers?: ResponseHeader[];
    //     httpVersion?: string;
    //     message?: string;
    //     parentId?: string;
    //     settingSendCookies?: boolean;
    //     settingStoreCookies?: boolean;
    //     statusCode?: number;
    //     statusMessage?: string;
    //     timelinePath?: string;
    //     url?: string;
    // }
    // debugTimeline: ResponseTimelineEntry[];
    // headerResults: HeaderResult[];
    // export interface HeaderResult {
    //     headers: ResponseHeader[];
    // export interface ResponseHeader {
    //     name: string;
    //     value: string;
    // }
    //     version: string;
    //     code: number;
    //     reason: string;
    // }
    // responseBodyPath?: string;

    // output
    // export interface ResponseOptions {
    //     code: number;
    //     reason?: string;
    //     header?: HeaderOptions[];
    //     cookie?: CookieOptions[];
    //     body?: string;
    //     // originally stream's type is ‘Buffer | ArrayBuffer’, but it should work in both browser and node
    //     stream?: ArrayBuffer;
    //     responseTime: number;
    //     status?: string;
    // }

    const lastRedirect = result.headerResults[result.headerResults.length - 1];

    const code = lastRedirect.code;
    const reason = lastRedirect.reason;
    const status = lastRedirect.reason;
    const responseTime = result.patch.elapsedTime;
    const headers = lastRedirect.headers.map(
        (header: { name: string; value: string }) => ({ key: header.name, value: header.value })
    );
    const cookieHeaders = lastRedirect.headers.filter(header => {
        return header.name.toLowerCase() === 'set-cookie';
    });
    // TODO: tackle stream field but currently it is just a duplication of body
    const cookies = cookieHeaders
        .map(cookieHeader => {
            const cookieObj = Cookie.parse(cookieHeader.value || '');
            if (cookieObj != null) {
                return {
                    key: cookieObj.key,
                    value: cookieObj.value,
                    expires: cookieObj.expires,
                    maxAge: cookieObj.maxAge,
                    domain: cookieObj.domain,
                    path: cookieObj.path,
                    secure: cookieObj.secure,
                    httpOnly: cookieObj.httpOnly,
                    hostOnly: cookieObj.hostOnly,
                    // session: cookieObj.session, // not supported
                    // extensions: cookieObj.extensions, // TODO:
                };
            }

            return cookieObj;
        })
        .filter(cookieOpt => cookieOpt !== undefined);

    if (!result.responseBodyPath) {
        return new Response({
            code,
            reason,
            header: headers,
            cookie: cookies as CookieOptions[],
            body: '',
            // stream,
            responseTime,
            status,
        });
    }

    const bodyResult = await window.main.readCurlResponse({
        bodyPath: result.responseBodyPath,
        bodyCompression: result.patch.bodyCompression,
    });
    if (bodyResult.error) {
        throw Error(bodyResult.error);
    }
    return new Response({
        code,
        reason,
        header: headers,
        cookie: cookies as CookieOptions[],
        body: bodyResult.body,
        // stream,
        responseTime,
        status,
    });
}

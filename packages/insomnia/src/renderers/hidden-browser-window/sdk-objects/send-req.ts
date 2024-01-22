import { Cookie } from 'tough-cookie';
import { v4 as uuidv4 } from 'uuid';

import { getSetCookieHeaders } from '../../../../src/common/misc';
import {
    // AUTH_API_KEY,
    AUTH_ASAP,
    AUTH_AWS_IAM,
    AUTH_BASIC,
    // AUTH_BEARER,
    AUTH_DIGEST,
    AUTH_HAWK,
    AUTH_NETRC,
    AUTH_NONE,
    AUTH_NTLM,
    AUTH_OAUTH_1,
    AUTH_OAUTH_2,
    // HAWK_ALGORITHM_SHA1,
    // HAWK_ALGORITHM_SHA256,
} from '../../../common/constants';
import type { CurlRequestOptions, CurlRequestOutput } from '../../../main/network/libcurl-promise';
import { newAuth } from '../../../models/request';
import { cancellablePromise, deleteCancelRequestFunctionMap, setCancelRequestFunctionMap } from '../../../network/cancellation';
import { RequestAuth } from './auth';
import { Settings } from './common';
import { CookieOptions } from './cookies';
import { Request, Response } from './req-resp';

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
            return newAuth(AUTH_NONE, {});
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
            return newAuth(
                AUTH_BASIC,
                {
                    useISO88591: false,
                    disabled: false,
                    username: findValueInObj('username', authObj.basic),
                    password: findValueInObj('password', authObj.basic),
                }
            );
        case 'digest':
            return newAuth(
                AUTH_DIGEST,
                {
                    disabled: false,
                    username: findValueInObj('username', authObj.digest),
                    password: findValueInObj('password', authObj.digest),
                }
            );
        case 'ntlm':
            return newAuth(
                AUTH_NTLM,
                {
                    disabled: false,
                    username: findValueInObj('username', authObj.ntlm),
                    password: findValueInObj('password', authObj.ntlm),
                }
            );
        case 'oauth1':
            return newAuth(
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
            return newAuth(AUTH_OAUTH_2, {});
        case 'awsv4':
            return newAuth(
                AUTH_AWS_IAM,
                {
                    disabled: false,
                    accessKeyId: findValueInObj('accessKey', authObj.awsv4),
                    secretAccessKey: findValueInObj('secretKey', authObj.awsv4),
                    sessionToken: findValueInObj('sessionToken', authObj.awsv4),
                }
            );
        case 'hawk':
            return newAuth(AUTH_HAWK, {});
        case 'asap':
            return newAuth(
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
            return newAuth(AUTH_NETRC, {});
        default:
            throw Error(`unknown auth type: ${authObj.type}`);
    }
}

export class HttpRequestSender {
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
                cb(undefined, fromCurlOutputToResponse(output));
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

function fromRequestToCurlOptions(req: string | Request, settings: Settings): CurlRequestOptions {
    if (typeof req === 'string') {
        return {
            requestId: `pre-request-script-adhoc-str-req:${uuidv4()}`,
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
                cookieJar: undefined,
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
            requestId: req.id || `pre-request-script-adhoc-req:${uuidv4()}`,
            req: {
                headers: req.headers.map(header => ({ name: header.key, value: header.value }), {}),
                method: 'GET',
                body: { mimeType: undefined }, // TODO: use value from headers
                authentication: transformAuthentication(req.auth),
                settingFollowRedirects: settings.followRedirects ? 'on' : 'off',
                settingRebuildPath: true,
                settingSendCookies: true,
                url: req.url.toString(),
                cookieJar: undefined,
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

function fromCurlOutputToResponse(result: CurlRequestOutput): Response {
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
    const headers = lastRedirect.headers.map(
        (header: { name: string; value: string }) => ({ key: header.name, value: header.value })
    );
    const cookieHeaders = getSetCookieHeaders(lastRedirect.headers);
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

    // TODO: tackle response
    // responseBodyPath;
    // const body = '';
    // const stream: ArrayBuffer =
    const status = lastRedirect.reason;
    const responseTime = result.patch.elapsedTime;

    const resp = new Response({
        code,
        reason,
        header: headers,
        cookie: cookies as CookieOptions[],
        // body,
        // stream,
        responseTime,
        status,
    });

    return resp;
}

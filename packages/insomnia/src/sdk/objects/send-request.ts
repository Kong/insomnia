import { Cookie } from 'tough-cookie';
import { v4 as uuidv4 } from 'uuid';

import type { CurlRequestOutput } from '../../main/network/libcurl-promise';
import type { RequestAuthentication } from '../../models/request';
import type { Settings } from '../../models/settings';
import { RequestAuth } from './auth';
import type { CookieOptions } from './cookies';
import { Request, type RequestOptions } from './request';
import { Response } from './response';

export function fromPreRequestAuth(auth: RequestAuth): RequestAuthentication {
    const authObj = auth.toJSON();
    // const findValueInObj = (targetKey: string, kvs?: { key: string; value: string }[]) => {
    //     if (!kvs) {
    //         return '';
    //     }

    //     return kvs.find((kv: { key: string; value: string }) => kv.key === targetKey ? kv.value : '', '');
    // };

    switch (authObj.type) {
        case 'noauth':
            return { type: 'none' };
        // TODO: these 2 methods are not supported yet
        // case 'apikey':
        //     return {
        //         disabled: false,
        //         type: 'apikey',
        //         key: findValueInObj('key', authObj.apikey),
        //         value: findValueInObj('value', authObj.apikey),
        //         in: findValueInObj('in', authObj.apikey),
        //     };
        // case 'bearer':
        //     return {
        //         type: 'bearer',
        //         disabled: false,
        //         token: findValueInObj('token', authObj.bearer),
        //     };
        // case 'basic':
        //     return {
        //         type: 'basic',
        //         useISO88591: false,
        //         disabled: false,
        //         username: findValueInObj('username', authObj.basic),
        //         password: findValueInObj('password', authObj.basic),
        //     };
        // case 'digest':
        //     return {
        //         type: 'digest',
        //         disabled: false,
        //         username: findValueInObj('username', authObj.digest),
        //         password: findValueInObj('password', authObj.digest),
        //     };
        // case 'ntlm':
        //     return {
        //         type: 'ntlm',
        //         disabled: false,
        //         username: findValueInObj('username', authObj.ntlm),
        //         password: findValueInObj('password', authObj.ntlm),
        //     };
        // case 'oauth1':
        //     return {
        //         type: 'oauth1',
        //         disabled: false,
        //         signatureMethod: 'HMAC-SHA1',
        //         consumerKey: findValueInObj('consumerKey', authObj.oauth1),
        //         consumerSecret: findValueInObj('consumerSecret', authObj.oauth1),
        //         tokenKey: findValueInObj('token', authObj.oauth1),
        //         tokenSecret: findValueInObj('tokenSecret', authObj.oauth1),
        //         privateKey: findValueInObj('verifier', authObj.oauth1),
        //         version: '1.0',
        //         nonce: findValueInObj('nonce', authObj.oauth1),
        //         timestamp: findValueInObj('timestamp', authObj.oauth1),
        //         callback: findValueInObj('callback', authObj.oauth1),
        //     };
        case 'oauth2':
            return {
                type: 'oauth2',
                grantType: 'authorization_code',
            };
        // case 'awsv4':
        //     return {
        //         type: 'iam',
        //         disabled: false,
        //         accessKeyId: findValueInObj('accessKey', authObj.awsv4),
        //         secretAccessKey: findValueInObj('secretKey', authObj.awsv4),
        //         sessionToken: findValueInObj('sessionToken', authObj.awsv4),
        //     };
        // case 'hawk':
        //     return {
        //         type: 'hawk',
        //         algorithm: 'sha256',
        //     };
        // case 'asap':
        //     return {
        //         type: 'asap',
        //         issuer: findValueInObj('iss', authObj.asap),
        //         subject: findValueInObj('sub', authObj.asap),
        //         audience: findValueInObj('aud', authObj.asap),
        //         additionalClaims: findValueInObj('claims', authObj.asap),
        //         keyId: findValueInObj('kid', authObj.asap),
        //         verifier: findValueInObj('privateKey', authObj.asap),
        //     };
        case 'netrc':
            throw Error('netrc auth is not supported yet');
        default:
            throw Error(`unknown auth type: ${authObj.type}`);
    }
}

export function toPreRequestAuth(auth: RequestAuthentication) {
    if (!auth || !auth.type) {
        return { type: 'noauth' };
    }

    switch (auth.type) {
        case 'none':
            return { type: 'noauth' };
        case 'apikey':
            return {
                type: 'apikey',
                apikey: [
                    // TODO: make this work
                    // { key: 'key', value: auth.key },
                    // { key: 'value', value: auth.value },
                    // { key: 'in', value: auth.in || 'header' },
                ],
            };
        case 'bearer':
            return {
                type: 'bearer',
                bearer: [
                    { key: 'token', value: auth.token },
                ],
            };
        case 'basic':
            return {
                type: 'basic',
                basic: [
                    { key: 'useISO88591', value: auth.useISO88591 },
                    { key: 'disabled', value: auth.disabled },
                    { key: 'username', value: auth.username },
                    { key: 'password', value: auth.password },
                ],
            };
        case 'digest':
            return {
                type: 'digest',
                digest: [
                    { key: 'disabled', value: auth.disabled },
                    { key: 'username', value: auth.username },
                    { key: 'password', value: auth.password },
                ],
            };
        case 'ntlm':
            return {
                type: 'ntlm',
                ntlm: [
                    { key: 'disabled', value: auth.disabled },
                    { key: 'username', value: auth.username },
                    { key: 'password', value: auth.password },
                ],
            };
        case 'oauth1':
            return {
                type: 'oauth1',
                oauth1: [
                    { key: 'disabled', value: auth.disabled },
                    { key: 'consumerKey', value: auth.consumerKey },
                    { key: 'consumerSecret', value: auth.consumerSecret },
                    { key: 'tokenKey', value: auth.tokenKey },
                    { key: 'tokenSecret', value: auth.tokenSecret },
                    { key: 'privateKey', value: auth.privateKey },
                    { key: 'version', value: auth.version },
                    { key: 'nonce', value: auth.nonce },
                    { key: 'timestamp', value: auth.timestamp },
                    { key: 'callback', value: auth.callback },
                ],
            };
        case 'oauth2':
            return {
                type: 'oauth2',
                oauth2: [
                    // TODO: make this work
                    // { key: 'key', value: auth.key },
                    // { key: 'value', value: auth.value },
                    // { key: 'enabled', value: auth.enabled },
                    // { key: 'send_as', value: auth.send_as },
                ],
            };
        case 'iam':
            return {
                type: 'awsv4',
                awsv4: [
                    { key: 'disabled', value: auth.disabled },
                    { key: 'accessKeyId', value: auth.accessKeyId },
                    { key: 'secretAccessKey', value: auth.secretAccessKey },
                    { key: 'sessionToken', value: auth.sessionToken },
                ],
            };
        case 'hawk':
            // TODO: actually it is not supported
            return {
                type: 'hawk',
                hawk: [
                    // TODO: make this work
                    // { key: 'includePayloadHash', value: auth.includePayloadHash },
                    // { key: 'timestamp', value: auth.timestamp },
                    // { key: 'delegation', value: auth.delegation },
                    // { key: 'app', value: auth.app },
                    // { key: 'extraData', value: auth.extraData },
                    // { key: 'nonce', value: auth.nonce },
                    // { key: 'user', value: auth.user },
                    // { key: 'authKey', value: auth.authKey },
                    // { key: 'authId', value: auth.authId },
                    // { key: 'algorithm', value: auth.algorithm },
                    // { key: 'id', value: auth.id },
                ],
            };
        case 'asap':
            return {
                type: 'asap',
                asap: [
                    // TODO: make this work
                    // { key: 'exp', value: auth.exp },
                    // { key: 'claims', value: auth.claims },
                    // { key: 'sub', value: auth.sub },
                    // { key: 'privateKey', value: auth.privateKey },
                    // { key: 'kid', value: auth.kid },
                    // { key: 'aud', value: auth.aud },
                    // { key: 'iss', value: auth.iss },
                    // { key: 'alg', value: auth.alg },
                    // { key: 'id', value: auth.id },
                ],
            };
        case 'netrc':
            // TODO: not supported yet
            throw Error('net rc is not supported yet');
        default:
            // @ts-expect-error - user can input any string
            throw Error(`unknown auth type: ${auth.type}`);
    }
}

export function sendRequest(
    request: string | Request | RequestOptions,
    cb: (error?: string, response?: Response) => void,
    settings: Settings, // TODO: modify this after introducing settings
) {
    // TODO(george): enable cascading cancellation later as current solution just adds complexity
    const requestOptions = requestToCurlOptions(request, settings);

    try {
        window.bridge.curlRequest(requestOptions)
            .then(result => {
                const output = result as CurlRequestOutput;
                return curlOutputToResponse(output, request);
            }).then(transformedOutput => {
                cb(undefined, transformedOutput);
            }).catch(e => {
                cb(e, undefined);
            });
    } catch (err) {
        if (err.name === 'AbortError') {
            cb(`Request was cancelled: ${err.message}`, undefined);
            return;
        }
        cb(`Something went wrong: ${err.message}`, undefined);
    }
};

function requestToCurlOptions(req: string | Request | RequestOptions, settings: Settings) {
    const id = uuidv4();
    const settingFollowRedirects: 'global' | 'on' | 'off' = settings.followRedirects ? 'on' : 'off';

    if (typeof req === 'string') {
        return {
            requestId: `pre-request-script-adhoc-req-simple:${id}`,
            req: {
                headers: [],
                method: 'GET',
                body: { mimeType: undefined }, // no body is set so it's type is undefined
                authentication: fromPreRequestAuth(
                    new RequestAuth({ type: 'noauth' }),
                ),
                settingFollowRedirects: settingFollowRedirects,
                settingRebuildPath: true,
                settingSendCookies: true,
                url: req,
                // currently cookies should be handled by user in headers
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
            authHeader: undefined, // TODO: add this for bearer and other auth methods
        };
    } else if (req instanceof Request || typeof req === 'object') {
        const finalReq = req instanceof Request ? req : new Request(req);

        let mimeType = 'application/octet-stream';
        if (finalReq.body) {
            switch (finalReq.body.mode) {
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
                    throw Error(`unknown body mode: ${finalReq.body.mode}`);
            }
        }

        // const authHeaders = [];
        // const authObj = fromPreRequestAuth(finalReq.auth);
        // switch (authObj.type) {
        //     case 'apikey':
        //         if (authObj.in === 'header') {
        //             authHeaders.push({
        //                 name: authObj.key,
        //                 value: authObj.key,
        //             });
        //         }
        //     case 'bearer':
        //         authHeaders.push({
        //             name: 'Authorization',
        //             value: `Bearer ${authObj.token}`,
        //         });
        //     default:
        //     // TODO: support other methods
        // }

        const urlencodedParams = finalReq.body?.urlencoded?.all().map(
            param => ({ name: param.key, value: param.value }),
        );
        const formdataParams = finalReq.body?.formdata?.all().map(
            param => ({
                type: param.type,
                name: param.key,
                value: param.type === 'file' ? '' : param.value,
                fileName: param.type === 'file' ? param.value : '',
            }),
        );

        const params = finalReq.body?.mode === 'formdata' || finalReq.body?.mode === 'urlencoded' ?
            finalReq.body?.mode === 'formdata' ? formdataParams : urlencodedParams :
            [];

        return {
            requestId: finalReq.id || `pre-request-script-adhoc-req-custom:${id}`,
            req: {
                headers: finalReq.headers.map(header => ({ name: header.key, value: header.value }), {}),
                method: finalReq.method,
                body: {
                    mimeType,
                    method: finalReq.method,
                    text: finalReq.body?.toString(),
                    params,
                    fileName: finalReq.body?.mode === 'file' ? finalReq.body?.toString() : undefined,
                },
                authentication: fromPreRequestAuth(finalReq.auth),
                settingFollowRedirects: settingFollowRedirects,
                settingRebuildPath: true,
                settingSendCookies: true,
                url: finalReq.url.toString(),
                // currently cookies should be handled by user in headers
                cookieJar: {
                    cookies: [],
                },
                cookies: [],
                suppressUserAgent: finalReq.headers.map(
                    h => h.key.toLowerCase() === 'user-agent' && h.disabled === true,
                    {},
                ).length > 0,
            },
            finalUrl: finalReq.url.toString(),
            settings,
            certificates: finalReq.certificate ?
                [{
                    host: finalReq.certificate?.name || '',
                    passphrase: finalReq.certificate?.passphrase || '',
                    cert: finalReq.certificate?.cert?.src || '',
                    key: finalReq.certificate?.key?.src || '',
                    pfx: finalReq.certificate?.pfx?.src || '',
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
            caCertficatePath: null, // the request in pre-request script doesn't support customizing ca yet
            socketPath: undefined,
            authHeader: undefined, // TODO: add this for bearer and other auth methods
        };
    }

    throw Error('the request type must be: string | Request | RequestOptions.');
}

async function curlOutputToResponse(
    result: CurlRequestOutput,
    request: string | Request | RequestOptions,
): Promise<Response> {
    const lastRedirect = result.headerResults[result.headerResults.length - 1];

    const originalRequest = typeof request === 'string' ?
        new Request({ url: request, method: 'GET' }) :
        request instanceof Request ?
            request :
            new Request(request);

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
                    // extensions: cookieObj.extensions,
                };
            }

            return cookieObj;
        })
        .filter(cookieOpt => cookieOpt !== undefined);

    if (!result.responseBodyPath) {
        return new Response({
            code: lastRedirect.code,
            reason: lastRedirect.reason,
            header: headers,
            cookie: cookies as CookieOptions[],
            body: '',
            stream: undefined,
            responseTime: result.patch.elapsedTime,
            status: lastRedirect.reason,
            originalRequest,
        });
    }

    const bodyResult = await window.bridge.readCurlResponse({
        bodyPath: result.responseBodyPath,
        bodyCompression: result.patch.bodyCompression,
    });
    if (bodyResult.error) {
        throw Error(bodyResult.error);
    }
    return new Response({
        code: lastRedirect.code,
        reason: lastRedirect.reason,
        header: headers,
        cookie: cookies as CookieOptions[],
        body: bodyResult.body,
        // stream is always undefined
        // because it is inaccurate to differentiate if body is binary
        stream: undefined,
        responseTime: result.patch.elapsedTime,
        status: lastRedirect.reason,
        originalRequest,
    });
}

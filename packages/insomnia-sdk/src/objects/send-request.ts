import type { CurlRequestOutput } from 'insomnia/src/main/network/libcurl-promise';
import { readCurlResponse } from 'insomnia/src/models/response';
import type { Settings } from 'insomnia/src/models/settings';
import { Cookie } from 'tough-cookie';
import { v4 as uuidv4 } from 'uuid';

import { RequestAuth } from './auth';
import { fromPreRequestAuth } from './auth';
import type { CookieOptions } from './cookies';
import { Request, type RequestOptions } from './request';
import { Response } from './response';

export async function sendRequest(
    request: string | Request | RequestOptions,
    cb: (error?: string, response?: Response) => void,
    settings: Settings,
): Promise<Response | undefined> {
    return new Promise<Response | undefined>(async resolve => {
        // TODO(george): enable cascading cancellation later as current solution just adds complexity
        const requestOptions = requestToCurlOptions(request, settings);

        try {
            const nodejsCurlRequest = process.type === 'renderer' ? window.bridge.curlRequest : (await import('insomnia/src/main/network/libcurl-promise')).curlRequest;
            nodejsCurlRequest(requestOptions)
                .then((result: any) => {
                    const output = result as CurlRequestOutput;
                    return curlOutputToResponse(output, request);
                }).then((transformedOutput: Response) => {
                    cb(undefined, transformedOutput);
                    resolve(transformedOutput);
                }).catch(e => {
                    cb(e, undefined);
                    resolve(undefined);
                });
        } catch (err: any) {
            if (err.name === 'AbortError') {
                cb(`Request was cancelled: ${err.message}`, undefined);
            } else {
                cb(`Something went wrong: ${err.message}`, undefined);
            }
            resolve(undefined);
        }
    });
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
    if (result.headerResults.length === 0) {
        throw Error('curlOutputToResponse: no header result is found');
    }
    if (result.patch.error) {
        throw result.patch.error;
    }

    const lastRedirect = result.headerResults[result.headerResults.length - 1];
    if (!lastRedirect) {
        throw Error('curlOutputToResponse: the lastRedirect is not defined');
    }

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
            const cookieObj = Cookie.parse(cookieHeader.value || '', { loose: true });
            if (cookieObj) {
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
            originalRequest,
        });
    }
    const nodejsReadCurlResponse = process.type === 'renderer' ? window.bridge.readCurlResponse : readCurlResponse;
    const bodyResult = await nodejsReadCurlResponse({
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
        originalRequest,
    });
}

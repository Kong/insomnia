import deepEqual from 'deep-equal';
import { RESPONSE_CODE_REASONS } from 'insomnia/src/common/constants';
import { sendCurlAndWriteTimelineError, type sendCurlAndWriteTimelineResponse } from 'insomnia/src/network/network';

import { Cookie, CookieOptions } from './cookies';
import { CookieList } from './cookies';
import { Header, HeaderDefinition, HeaderList } from './headers';
import { Property, unsupportedError } from './properties';
import { Request } from './request';

export interface ResponseOptions {
    code: number;
    reason?: string;
    header?: HeaderDefinition[];
    cookie?: CookieOptions[];
    body?: string;
    // ideally it should work in both browser and node
    stream?: Buffer | ArrayBuffer;
    responseTime: number;
    originalRequest: Request;
}

export interface ResponseContentInfo {
    mimeType: string;
    mimeFormat: string;
    charset: string;
    fileExtension: string;
    fileName: string;
    contentType: string;
}

// TODO: unknown usage
// export interface Timings

export class Response extends Property {
    body: string;
    code: number;
    cookies: CookieList;
    headers: HeaderList<Header>;
    originalRequest: Request;
    responseTime: number;
    status: string;
    stream?: Buffer | ArrayBuffer;

    constructor(options: ResponseOptions) {
        super();

        this._kind = 'Response';

        this.body = options.body || '';
        this.code = options.code;
        this.cookies = new CookieList(
            options.cookie?.map(cookie => new Cookie(cookie)) || [],
        );
        this.headers = new HeaderList(
            undefined,
            options.header?.map(headerOpt => new Header(headerOpt)) || [],
        );
        this.originalRequest = options.originalRequest;
        this.responseTime = options.responseTime;
        this.status = options.reason || RESPONSE_CODE_REASONS[options.code];
        this.stream = options.stream;
    }

    // TODO: the accurate type of the response should be given
    static createFromNode(
        response: {
            body: string;
            headers: HeaderDefinition[];
            statusCode: number;
            statusMessage: string;
            elapsedTime: number;
            originalRequest: Request;
            stream: Buffer | ArrayBuffer;
        },
        cookies: CookieOptions[],
    ) {
        return new Response({
            cookie: cookies,
            body: response.body.toString(),
            stream: response.stream,
            header: response.headers,
            code: response.statusCode,
            reason: response.statusMessage,
            responseTime: response.elapsedTime,
            originalRequest: response.originalRequest,
        });
    }

    static isResponse(obj: object) {
        return '_kind' in obj && obj._kind === 'Response';
    }

    contentInfo(): ResponseContentInfo {
        const mimeInfo = {
            mimeType: 'application/octet-stream',
            mimeFormat: '', // TODO: it's definition is unknown
            charset: 'utf-8',
        };

        const contentType = this.headers.find(header => header.key === 'Content-Type');
        if (contentType) {
            const directives = contentType.valueOf().split('; ');
            if (directives.length === 0) {
                throw Error('contentInfo: header Content-Type value is blank');
            } else {
                mimeInfo.mimeType = directives[0];
                directives.forEach(dir => {
                    if (dir.startsWith('charset')) {
                        mimeInfo.charset = dir.slice(dir.indexOf('=') + 1);
                    }
                });
            }
        }

        const fileInfo = {
            extension: '',
            name: 'unknown',
        };

        const contentDisposition = this.headers.find(header => header.key === 'Content-Disposition');;
        if (contentDisposition) {
            const directives = contentDisposition.valueOf().split('; ');
            directives.forEach(dir => {
                if (dir.startsWith('filename')) {
                    const fileName = fileInfo.extension = dir.slice(dir.indexOf('=') + 1);
                    fileInfo.name = fileName.slice(1, fileName.lastIndexOf('.')); // ignore '"' arounds the file name
                    fileInfo.extension = fileName.slice(fileName.lastIndexOf('.') + 1, fileName.length - 1);
                }
            });
        }

        return {
            mimeType: mimeInfo.mimeType,
            mimeFormat: mimeInfo.mimeFormat,
            charset: mimeInfo.charset,
            fileExtension: fileInfo.extension,
            fileName: fileInfo.name,
            contentType: contentType?.valueOf() || 'application/octet-stream',
        };
    }

    dataURI() {
        const contentInfo = this.contentInfo();
        const bodyInBase64 = this.stream || this.body;
        if (!bodyInBase64) {
            throw Error('dataURI(): response body is not defined');
        }

        return `data:${contentInfo.contentType};baseg4, <base64-encoded-body>`;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    json(reviver?: (key: string, value: any) => any, _strict?: boolean) {
        // TODO: enable strict after common module is introduced
        try {
            return JSON.parse(this.body.toString(), reviver);
        } catch (e) {
            throw Error(`json: failed to parse: ${e}`);
        }
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    jsonp(_reviver?: (key: string, value: any) => any, _strict?: boolean) {
        throw unsupportedError('jsonp');
    }

    reason() {
        return this.status;
    }

    size(): number {
        try {
            const contentLength = this.headers.get('Content-Length');
            // TODO: improve this by manual counting
            console.log(this.headers.get('Content-Length'));
            return contentLength == null ? -1 : parseInt(contentLength.valueOf());
        } catch (e) {
            throw Error('size: ${e}');
        }
    }

    text() {
        return this.body.toString();
    }

    // Besides chai.expect, "to" is extended to support cases like:
    // insomnia.response.to.have.status(200);
    get to() {
        type valueType = boolean | number | string | object | undefined;
        const verify = (got: valueType, expected: valueType) => {
            if (['boolean', 'number', 'string', 'undefined'].includes(typeof got) && expected === got) {
                return;
            } else if (deepEqual(got, expected, { strict: true })) {
                return;
            }
            throw Error(`"${got}" is not equal to the expected value: "${expected}"`);
        };

        return {
            // follows extend chai's chains for compatibility
            have: {
                status: (expected: number | string) => {
                    if (typeof expected === 'string') {
                        verify(this.status, expected);
                    } else {
                        verify(this.code, expected);
                    }
                },
                header: (expected: string) => verify(
                    this.headers.toObject().find(header => header.key === expected) !== undefined,
                    true,
                ),

                body: (expected: string) => verify(this.text(), expected),
                jsonBody: (expected: object) => verify(this.json(), expected),
            },
        };
    }
}

export function toScriptResponse(
    originalRequest: Request,
    partialInsoResponse: sendCurlAndWriteTimelineResponse | sendCurlAndWriteTimelineError,
    responseBody: string,
): Response | undefined {
    if ('error' in partialInsoResponse) {
    // it is sendCurlAndWriteTimelineError and basically doesn't contain anything useful
        return undefined;
    }
    const partialResponse = partialInsoResponse as sendCurlAndWriteTimelineResponse;

    const headers = partialResponse.headers ?
        partialResponse.headers.map(
            insoHeader => ({
                key: insoHeader.name,
                value: insoHeader.value,
            }),
            {},
        )
        : [];

    const insoCookieOptions = partialResponse.headers ?
        partialResponse.headers
            .filter(
                header => {
                    return header.name.toLowerCase() === 'set-cookie';
                },
                {},
            ).map(
                setCookieHeader => Cookie.parse(setCookieHeader.value)
        )
        : [];

    const responseOption = {
        code: partialResponse.statusCode || 0,
        reason: partialResponse.statusMessage,
        header: headers,
        cookie: insoCookieOptions,
        body: responseBody,
        // stream is duplicated with body
        responseTime: partialResponse.elapsedTime,
        originalRequest,
    };

    return new Response(responseOption);
};

export async function readBodyFromPath(response: sendCurlAndWriteTimelineResponse | sendCurlAndWriteTimelineError | undefined) {
    // it allows to execute scripts (e.g., for testing) but body contains nothing
    if (!response || 'error' in response) {
        return '';
    } else if (!response.bodyPath) {
        return '';
    }

    const readResponseResult = await window.bridge.readCurlResponse({
        bodyPath: response.bodyPath,
        bodyCompression: response.bodyCompression,
    });

    if (readResponseResult.error) {
        throw Error(`Failed to read body: ${readResponseResult.error}`);
    }
    return readResponseResult.body;
}

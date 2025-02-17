import Ajv from 'ajv';
import deepEqual from 'deep-equal';
import { RESPONSE_CODE_REASONS } from 'insomnia/src/common/constants';
import { readCurlResponse } from 'insomnia/src/models/response';
import type { sendCurlAndWriteTimelineError, sendCurlAndWriteTimelineResponse } from 'insomnia/src/network/network';

import { Cookie, type CookieOptions } from './cookies';
import { CookieList } from './cookies';
import { Header, type HeaderDefinition, HeaderList } from './headers';
import { Property, unsupportedError } from './properties';
import { calculateHeadersSize, Request } from './request';

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
    bytesRead?: number; // this is from Insomnia for returning response size() directly
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

    private bytesRead: number; //

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
        this.stream = options.stream;
        const detectedStatus = options.reason || RESPONSE_CODE_REASONS[options.code];
        if (!detectedStatus) {
            throw Error('Response constructor: reason or code field must be set in the options');
        } else {
            this.status = detectedStatus;
        }

        this.bytesRead = options.bytesRead || 0;
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
                const mimeType = directives[0];
                if (!mimeType) {
                    throw Error('contentInfo: mime type in header Content-Type is invalid');
                }
                mimeInfo.mimeType = mimeType;
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

        return `data:${contentInfo.contentType};baseg4, ${bodyInBase64}`;
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

    size() {
        const headerSize = calculateHeadersSize(this.headers);
        return {
            body: this.bytesRead,
            header: headerSize,
            total: this.bytesRead + headerSize,
            source: 'COMPUTED',
        };
    }

    text() {
        return this.body.toString();
    }

    // Besides chai.expect, "to" is extended to support cases like:
    // insomnia.response.to.have.status(200);
    // insomnia.response.to.not.have.status(200);
    get to() {
        type valueType = boolean | number | string | object | undefined;

        const verify = (got: valueType, expected: valueType, checkEquality: boolean = true) => {
            if (['boolean', 'number', 'string', 'undefined'].includes(typeof got)) {
                if ((checkEquality && expected === got) || (!checkEquality && expected !== got)) {
                    return;
                }
            } else if (
                (checkEquality && deepEqual(got, expected, { strict: true })) ||
                (!checkEquality && !deepEqual(got, expected, { strict: true }))
            ) {
                return;
            }
            throw Error(`"${got}" is not equal to the expected value: "${expected}"`);
        };
        const haveStatus = (expected: number | string, checkEquality: boolean) => {
            if (typeof expected === 'string') {
                verify(this.status, expected, checkEquality);
            } else {
                verify(this.code, expected, checkEquality);
            }
        };
        const haveHeader = (expected: string, checkEquality: boolean) => verify(
            this.headers.toObject().find(header => header.key === expected) !== undefined,
            checkEquality,
        );
        const haveBody = (expected: string, checkEquality: boolean) => verify(this.text(), expected, checkEquality);
        const haveJsonBody = (expected: object, checkEquality: boolean) => verify(this.json(), expected, checkEquality);
        const haveJsonSchema = (expected: object, checkEquality: boolean) => {
            const ajv = new Ajv();

            try {
                const jsonBody = JSON.parse(this.body);
                const schemaMatched = ajv.validate(expected, jsonBody);
                if ((schemaMatched && checkEquality) || (!schemaMatched && !checkEquality)) {
                    return;
                }
            } catch (e) {
                throw Error(`Failed to verify response body schema, response could not be a valid json: "${e}"`);
            }
            throw Error("Response's schema is not equal to the expected value");
        };

        return {
            // follows extend chai's chains for compatibility
            have: {
                status: (expected: number | string) => haveStatus(expected, true),
                header: (expected: string) => haveHeader(expected, true),
                body: (expected: string) => haveBody(expected, true),
                jsonBody: (expected: object) => haveJsonBody(expected, true),
                jsonSchema: (expected: object) => haveJsonSchema(expected, true),
            },
            not: {
                have: {
                    status: (expected: number | string) => haveStatus(expected, false),
                    header: (expected: string) => haveHeader(expected, false),
                    body: (expected: string) => haveBody(expected, false),
                    jsonBody: (expected: object) => haveJsonBody(expected, false),
                    jsonSchema: (expected: object) => haveJsonSchema(expected, false),
                },
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
        bytesRead: partialResponse.bytesRead,
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
    const nodejsReadCurlResponse = process.type === 'renderer' ? window.bridge.readCurlResponse : readCurlResponse;
    const readResponseResult = await nodejsReadCurlResponse({
        bodyPath: response.bodyPath,
        bodyCompression: response.bodyCompression,
    });

    if (readResponseResult.error) {
        throw Error(`Failed to read body: ${readResponseResult.error}`);
    }
    return readResponseResult.body;
}

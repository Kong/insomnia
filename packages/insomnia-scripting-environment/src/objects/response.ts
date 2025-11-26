import { Ajv, type ErrorObject } from 'ajv';
import * as chai from 'chai';
import { RESPONSE_CODE_REASONS } from 'insomnia/src/common/constants';
import { readCurlResponse } from 'insomnia/src/models/response';
import type { sendCurlAndWriteTimelineError, sendCurlAndWriteTimelineResponse } from 'insomnia/src/network/network';

import { Cookie, type CookieOptions } from './cookies';
import { CookieList } from './cookies';
import { Header, type HeaderDefinition, HeaderList } from './headers';
import { Property, unsupportedError } from './properties';
import type { Request } from './request';
import { calculateHeadersSize } from './request';

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
    this.cookies = new CookieList(options.cookie?.map(cookie => new Cookie(cookie)) || []);
    this.headers = new HeaderList(undefined, options.header?.map(headerOpt => new Header(headerOpt)) || []);
    this.originalRequest = options.originalRequest;
    this.responseTime = options.responseTime;
    this.stream = options.stream;
    this.status = options.reason || RESPONSE_CODE_REASONS[options.code] || '';
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
        throw new Error('contentInfo: header Content-Type value is blank');
      } else {
        const mimeType = directives[0];
        if (!mimeType) {
          throw new Error('contentInfo: mime type in header Content-Type is invalid');
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

    const contentDisposition = this.headers.find(header => header.key === 'Content-Disposition');
    if (contentDisposition) {
      const directives = contentDisposition.valueOf().split('; ');
      directives.forEach(dir => {
        if (dir.startsWith('filename')) {
          const fileName = (fileInfo.extension = dir.slice(dir.indexOf('=') + 1));
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
      throw new Error('dataURI(): response body is not defined');
    }

    return `data:${contentInfo.contentType};baseg4, ${bodyInBase64}`;
  }

  json(reviver?: (key: string, value: any) => any, _strict?: boolean) {
    // TODO: enable strict after common module is introduced
    try {
      return JSON.parse(this.body.toString(), reviver);
    } catch (e) {
      throw new Error(`json: failed to parse: ${e}`);
    }
  }

  jsonp(_reviver?: (key: string, value: any) => any, _strict?: boolean) {
    throw unsupportedError('jsonp()');
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
    const respAssertion = new chai.Assertion(this);

    chai.use((_chai, utils) => {
      utils.addProperty(chai.Assertion.prototype, 'withBody', () => {
        const resp: Response = utils.flag(respAssertion, 'object');
        const negate: boolean = utils.flag(respAssertion, 'negate');

        let respBody: object | undefined | string = undefined;

        try {
          respBody = resp.body ? resp.json() : undefined;
        } catch (e) {
          respBody = resp.body;
        }

        if (negate) {
          new chai.Assertion(respBody === undefined || respBody === null || respBody === '').to.equal(true);
        } else {
          new chai.Assertion(respBody).to.exist.and.not.equal('');
        }
      });

      utils.addProperty(chai.Assertion.prototype, 'error', () => {
        const resp: Response = utils.flag(respAssertion, 'object');
        const negate: boolean = utils.flag(respAssertion, 'negate');

        if (negate) {
          new chai.Assertion(resp.code).to.be.not.within(400, 500);
        } else {
          new chai.Assertion(resp.code).to.be.within(400, 500);
        }
      });

      utils.addProperty(chai.Assertion.prototype, 'ok', () => {
        const resp: Response = utils.flag(respAssertion, 'object');
        const negate: boolean = utils.flag(respAssertion, 'negate');

        if (negate) {
          new chai.Assertion(resp.code).to.not.equal(200);
        } else {
          new chai.Assertion(resp.code).to.equal(200);
        }
      });

      utils.addProperty(chai.Assertion.prototype, 'json', () => {
        const resp = utils.flag(respAssertion, 'object');
        const negate: boolean = utils.flag(respAssertion, 'negate');

        let respBody: object | undefined | string = undefined;
        try {
          respBody = resp.body ? resp.json() : undefined;
        } catch (e) {
          respBody = resp.body;
        }

        if (negate) {
          new chai.Assertion(respBody).to.be.not.an('object');
        } else {
          new chai.Assertion(respBody).to.be.an('object');
        }
      });

      utils.addMethod(chai.Assertion.prototype, 'status', (val: number) => {
        const resp: Response = utils.flag(respAssertion, 'object');
        const negate: boolean = utils.flag(respAssertion, 'negate');

        if (negate) {
          new chai.Assertion(resp.code).to.not.equal(val);
        } else {
          new chai.Assertion(resp.code).to.equal(val);
        }
      });

      utils.addMethod(chai.Assertion.prototype, 'header', (headerName: string) => {
        const resp: Response = utils.flag(respAssertion, 'object');
        const negate: boolean = utils.flag(respAssertion, 'negate');

        if (negate) {
          new chai.Assertion(resp.headers.get(headerName)).to.not.exist;
        } else {
          new chai.Assertion(resp.headers.get(headerName)).to.exist;
        }
      });

      utils.addMethod(chai.Assertion.prototype, 'body', (bodyContent: string) => {
        const resp: Response = utils.flag(respAssertion, 'object');
        const negate: boolean = utils.flag(respAssertion, 'negate');

        if (negate) {
          new chai.Assertion(resp.body).to.not.equal(bodyContent);
        } else {
          new chai.Assertion(resp.body).to.equal(bodyContent);
        }
      });

      utils.addMethod(chai.Assertion.prototype, 'jsonBody', (val: string) => {
        const resp: Response = utils.flag(respAssertion, 'object');
        const negate: boolean = utils.flag(respAssertion, 'negate');

        let respBody: object | undefined = undefined;
        try {
          respBody = resp.body ? resp.json() : {};
        } catch (e) {
          respBody = {};
        }

        if (negate) {
          new chai.Assertion(respBody).to.not.have.property(val);
        } else {
          new chai.Assertion(respBody).to.have.property(val);
        }
      });

      utils.addMethod(chai.Assertion.prototype, 'jsonSchema', (schema: object, options?: object) => {
        const resp: Response = utils.flag(respAssertion, 'object');
        const negate: boolean = utils.flag(respAssertion, 'negate');

        let respBody: object | undefined = undefined;
        try {
          respBody = resp.body ? resp.json() : {};
        } catch (e) {
          respBody = {};
        }

        const ajv = new Ajv(options);
        const validate = ajv.compile(schema);
        if (validate(respBody)) {
          if (negate) {
            new chai.Assertion(true, 'expected schema does match the response body').to.be.false;
          } else {
            new chai.Assertion(true).to.be.true;
          }
        } else {
          const errorMsg = validate.errors?.reduce((acc: string, error: ErrorObject) => {
            return `${acc}\n${error.instancePath}: ${error.message}`;
          }, '');

          if (negate) {
            new chai.Assertion(errorMsg, 'expected schema does match the response body').to.not.equal('');
          } else {
            new chai.Assertion(errorMsg, `expected schema not match ${errorMsg}`).to.equal('');
          }
        }
      });
    });

    return respAssertion;
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

  const headers = partialResponse.headers
    ? partialResponse.headers.map(
        insoHeader => ({
          key: insoHeader.name,
          value: insoHeader.value,
        }),
        {},
      )
    : [];

  const insoCookieOptions = partialResponse.headers
    ? partialResponse.headers
        .filter(header => {
          return header.name.toLowerCase() === 'set-cookie';
        }, {})
        .map(setCookieHeader => Cookie.parse(setCookieHeader.value))
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
}

export async function readBodyFromPath(
  response: sendCurlAndWriteTimelineResponse | sendCurlAndWriteTimelineError | undefined,
) {
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
    throw new Error(`Failed to read body: ${readResponseResult.error}`);
  }
  return readResponseResult.body;
}

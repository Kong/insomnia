import { globalBeforeEach } from '../../__jest__/before-each';
import {
  AUTH_AWS_IAM,
} from '../../common/constants';
import { filterHeaders } from '../../common/misc';
import * as networkUtils from '../network';

describe('_getAwsAuthHeaders', () => {
  beforeEach(globalBeforeEach);

  it('should generate expected headers', () => {
    const req = {
      authentication: {
        type: AUTH_AWS_IAM,
        accessKeyId: 'AKIA99999999',
        secretAccessKey: 'SAK9999999999999',
        sessionToken: 'ST9999999999999999',
      },
      headers: [
        {
          name: 'content-type',
          value: 'application/json',
        },
      ],
      body: {
        text: '{}',
      },
      method: 'POST',
      url: 'https://ec2.us-west-2.amazonaws.com/path?query=q1',
    };
    const credentials = {
      accessKeyId: req.authentication.accessKeyId || '',
      secretAccessKey: req.authentication.secretAccessKey || '',
      sessionToken: req.authentication.sessionToken || '',
    };

    const headers = networkUtils._getAwsAuthHeaders(
      credentials,
      req.headers,
      req.body.text,
      req.url,
      req.method,
    );

    expect(filterHeaders(headers, 'x-amz-date')[0].value).toMatch(/^\d{8}T\d{6}Z$/);
    expect(filterHeaders(headers, 'host')[0].value).toEqual('ec2.us-west-2.amazonaws.com');
    expect(filterHeaders(headers, 'authorization')[0].value).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIA99999999\/\d{8}\/us-west-2\/ec2\/aws4_request, SignedHeaders=content-length;content-type;host;x-amz-date;x-amz-security-token, Signature=[a-z0-9]*$/,
    );
    expect(filterHeaders(headers, 'content-type')).toEqual([]);
  });

  it('should handle sparse request', () => {
    const req = {
      authentication: {
        type: AUTH_AWS_IAM,
        accessKeyId: 'AKIA99999999',
        secretAccessKey: 'SAK9999999999999',
        sessionToken: 'ST99999999999999',
      },
      headers: ['Accept: */*', 'Accept-Encoding:'],
      url: 'https://example.com',
      method: 'GET',
    };
    const credentials = {
      accessKeyId: req.authentication.accessKeyId || '',
      secretAccessKey: req.authentication.secretAccessKey || '',
      sessionToken: req.authentication.sessionToken || '',
    };

    const headers = networkUtils._getAwsAuthHeaders(
      credentials,
      req.headers,
      null,
      req.url,
      req.method,
      'us-west-2',
      'ec2',
    );

    expect(filterHeaders(headers, 'x-amz-date')[0].value).toMatch(/^\d{8}T\d{6}Z$/);
    expect(filterHeaders(headers, 'host')[0].value).toEqual('example.com');
    expect(filterHeaders(headers, 'authorization')[0].value).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIA99999999\/\d{8}\/us-west-2\/ec2\/aws4_request, SignedHeaders=host;x-amz-date;x-amz-security-token, Signature=[a-z0-9]*$/,
    );
    expect(filterHeaders(headers, 'content-type')).toEqual([]);
  });
});

describe('_parseHeaders', () => {
  const basicHeaders = [
    'HTTP/1.1 301 Moved Permanently',
    'X-Powered-By: Express',
    'location: http://localhost:3000/',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Length: 17',
    'ETag: W/"11-WKzg6oYof0o8Mliwrz5pkw"',
    'Duplicate: foo',
    'Duplicate: bar',
    'Date: Mon, 13 Nov 2017 22:06:28 GMT',
    'Foo', // Invalid header
    '',
  ];
  const minimalHeaders = ['HTTP/1.1 301', ''];

  it('Parses single response headers', () => {
    expect(networkUtils._parseHeaders(Buffer.from(basicHeaders.join('\n')))).toEqual([
      {
        code: 301,
        version: 'HTTP/1.1',
        reason: 'Moved Permanently',
        headers: [
          {
            name: 'X-Powered-By',
            value: 'Express',
          },
          {
            name: 'location',
            value: 'http://localhost:3000/',
          },
          {
            name: 'Content-Type',
            value: 'text/plain; charset=utf-8',
          },
          {
            name: 'Content-Length',
            value: '17',
          },
          {
            name: 'ETag',
            value: 'W/"11-WKzg6oYof0o8Mliwrz5pkw"',
          },
          {
            name: 'Duplicate',
            value: 'foo',
          },
          {
            name: 'Duplicate',
            value: 'bar',
          },
          {
            name: 'Date',
            value: 'Mon, 13 Nov 2017 22:06:28 GMT',
          },
          {
            name: 'Foo',
            value: '',
          },
        ],
      },
    ]);
  });

  it('Parses Windows newlines', () => {
    expect(networkUtils._parseHeaders(Buffer.from(basicHeaders.join('\r\n')))).toEqual([
      {
        code: 301,
        version: 'HTTP/1.1',
        reason: 'Moved Permanently',
        headers: [
          {
            name: 'X-Powered-By',
            value: 'Express',
          },
          {
            name: 'location',
            value: 'http://localhost:3000/',
          },
          {
            name: 'Content-Type',
            value: 'text/plain; charset=utf-8',
          },
          {
            name: 'Content-Length',
            value: '17',
          },
          {
            name: 'ETag',
            value: 'W/"11-WKzg6oYof0o8Mliwrz5pkw"',
          },
          {
            name: 'Duplicate',
            value: 'foo',
          },
          {
            name: 'Duplicate',
            value: 'bar',
          },
          {
            name: 'Date',
            value: 'Mon, 13 Nov 2017 22:06:28 GMT',
          },
          {
            name: 'Foo',
            value: '',
          },
        ],
      },
    ]);
  });

  it('Parses multiple responses', () => {
    const blobs = basicHeaders.join('\r\n') + '\n' + minimalHeaders.join('\n');
    expect(networkUtils._parseHeaders(Buffer.from(blobs))).toEqual([
      {
        code: 301,
        version: 'HTTP/1.1',
        reason: 'Moved Permanently',
        headers: [
          {
            name: 'X-Powered-By',
            value: 'Express',
          },
          {
            name: 'location',
            value: 'http://localhost:3000/',
          },
          {
            name: 'Content-Type',
            value: 'text/plain; charset=utf-8',
          },
          {
            name: 'Content-Length',
            value: '17',
          },
          {
            name: 'ETag',
            value: 'W/"11-WKzg6oYof0o8Mliwrz5pkw"',
          },
          {
            name: 'Duplicate',
            value: 'foo',
          },
          {
            name: 'Duplicate',
            value: 'bar',
          },
          {
            name: 'Date',
            value: 'Mon, 13 Nov 2017 22:06:28 GMT',
          },
          {
            name: 'Foo',
            value: '',
          },
        ],
      },
      {
        code: 301,
        headers: [],
        reason: '',
        version: 'HTTP/1.1',
      },
    ]);
  });
});

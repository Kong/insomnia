import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { services } from 'insomnia-data';
import { servicesNodeImpl } from 'insomnia-data/node';
import { afterEach, describe, expect, it, vi } from 'vitest';

import * as plugin from '../response';

describe('init()', () => {
  it('initializes correctly', async () => {
    const result = plugin.init({});
    expect(Object.keys(result)).toEqual(['response']);
    expect(Object.keys(result.response).sort()).toEqual([
      'getBody',
      'getBodyStream',
      'getBytesRead',
      'getHeader',
      'getHeaders',
      'getRequestId',
      'getStatusCode',
      'getStatusMessage',
      'getTime',
      'hasHeader',
      'setBody',
    ]);
  });

  it('fails to initialize without response', () => {
    expect(() => plugin.init()).toThrowError('contexts.response initialized without response');
  });
});

describe('response.*', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('works for basic and full response', async () => {
    const bodyPath = path.join(tmpdir(), 'response.zip');
    fs.writeFileSync(bodyPath, Buffer.from('Hello World!'));
    const response = await services.response.create({
      bodyPath,
      bodyCompression: null,
      parentId: 'req_1',
      url: 'https://insomnia.rest',
      statusCode: 200,
      statusMessage: 'OK',
      bytesRead: 123,
      elapsedTime: 321,
    });
    const result = plugin.init(response);
    expect(result.response.getRequestId()).toBe('req_1');
    expect(result.response.getStatusCode()).toBe(200);
    expect(result.response.getBytesRead()).toBe(123);
    expect(result.response.getTime()).toBe(321);
    expect((await result.response.getBody())?.toString()).toBe('Hello World!');
  });

  it('works for basic and empty response', async () => {
    const result = plugin.init({});
    expect(result.response.getRequestId()).toBe('');
    expect(result.response.getStatusCode()).toBe(0);
    expect(result.response.getBytesRead()).toBe(0);
    expect(result.response.getTime()).toBe(0);
    expect((await result.response.getBody())?.length).toBe(0);
  });

  it('getBody returns a decodable Buffer even when the services bridge resolves a Uint8Array', async () => {
    const decoded = '{"echoNum":777}';
    const bridged = new Uint8Array(Buffer.from(decoded)) as unknown as Buffer;
    vi.spyOn(servicesNodeImpl.helpers, 'getResponseBodyBuffer').mockResolvedValue(bridged);

    const body = await plugin.init({ bodyPath: '/tmp/does-not-matter', statusCode: 200 }).response.getBody();

    expect(Buffer.isBuffer(body)).toBe(true);
    expect((body as Buffer).toString('utf8')).toBe(decoded);
  });

  it('setBody accepts bytes and strings, and rejects other values', () => {
    const bodyPath = path.join(tmpdir(), 'set-body.response');
    const { response } = plugin.init({ bodyPath });

    response.setBody(Buffer.from('from-buffer'));
    expect(fs.readFileSync(bodyPath, 'utf8')).toBe('from-buffer');

    response.setBody(new Uint8Array(Buffer.from('from-uint8')));
    expect(fs.readFileSync(bodyPath, 'utf8')).toBe('from-uint8');

    response.setBody('from-string');
    expect(fs.readFileSync(bodyPath, 'utf8')).toBe('from-string');

    expect(() => response.setBody(Promise.resolve() as unknown as string)).toThrow(TypeError);
    expect(() => response.setBody({} as unknown as string)).toThrow(/Buffer, Uint8Array, or string/);
  });

  it('works for getting headers', () => {
    const response = {
      headers: [
        {
          name: 'content-type',
          value: 'application/json',
        },
        {
          name: 'set-cookie',
          value: 'foo=bar',
        },
        {
          name: 'set-cookie',
          value: 'baz=qux',
        },
      ],
    };
    const result = plugin.init(response);
    expect(result.response.getHeaders()).toEqual([
      {
        name: 'content-type',
        value: 'application/json',
      },
      {
        name: 'set-cookie',
        value: 'foo=bar',
      },
      {
        name: 'set-cookie',
        value: 'baz=qux',
      },
    ]);
    expect(result.response.getHeader('Does-Not-Exist')).toBeNull();
    expect(result.response.getHeader('CONTENT-TYPE')).toBe('application/json');
    expect(result.response.getHeader('set-cookie')).toEqual(['foo=bar', 'baz=qux']);
    expect(result.response.hasHeader('foo')).toBe(false);
    expect(result.response.hasHeader('ConTent-Type')).toBe(true);
  });
});

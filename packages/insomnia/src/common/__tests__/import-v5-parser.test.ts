import { beforeAll, describe, expect, it } from 'vitest';
import type { z } from 'zod/v4';

import {
  ApiSpecSchema,
  CollectionSchema,
  CookieJarSchema,
  EnvironmentSchema,
  GRPCRequestSchema,
  HeadersSchema,
  InsomniaFileSchema,
  JsonSchema,
  KeyLiteralSchema,
  LiteralSchema,
  MetaGroupSchema,
  MetaSchema,
  MockRouteSchema,
  MockServerSchema,
  RequestCollectionSchema,
  RequestGroupSchema,
  RequestSchema,
  SocketIORequestSchema,
  WebsocketRequestSchema,
} from '../import-v5-parser';

// -----------------------------
// Polyfills & Utilities
// -----------------------------
beforeAll(() => {
  // Make tests deterministic when schema uses crypto.randomUUID()
  if (!globalThis.crypto || typeof globalThis.crypto.randomUUID !== 'function') {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    globalThis.crypto = {
      randomUUID: () => '00000000-0000-4000-8000-000000000000',
    };
  }
});

// -----------------------------
// Factory helpers
// (simple, local, no external deps)
// -----------------------------
const makeMeta = (overrides: Partial<z.infer<typeof MetaSchema>> = {}) => ({
  id: 'meta-1',
  ...overrides,
});

const makeHeader = (overrides: Partial<z.infer<typeof HeadersSchema>[number]> = {}) => ({
  name: 'Content-Type',
  value: 'application/json',
  ...overrides,
});

const makeCookieJar = () => ({
  name: 'jar',
  meta: makeMeta(),
  cookies: [{}], // exercise defaults
});

const makeEnvironment = (overrides: Record<string, unknown> = {}) => ({
  name: 'Main',
  meta: makeMeta(),
  data: { api: { baseUrl: 'https://api.example.com' } },
  color: '#00AA88',
  subEnvironments: [{ name: 'Dev', data: { api: { baseUrl: 'http://localhost:3000' } } }],
  ...overrides,
});

const makeHttpRequest = (overrides: Record<string, unknown> = {}) => ({
  url: 'https://example.com',
  name: 'Get Users',
  method: 'GET',
  headers: [makeHeader()],
  parameters: [{ name: 'q', value: 'john' }],
  pathParameters: [{ name: 'userId', value: '123' }],
  scripts: { preRequest: '', afterResponse: '' },
  authentication: { type: 'none' },
  settings: undefined, // allow defaults to fill
  ...overrides,
});

const makeGrpcRequest = (overrides: Record<string, unknown> = {}) => ({
  url: 'grpc://service.example',
  name: 'UserService.List',
  body: { text: '{"page":1}' },
  metadata: [{ name: 'authorization', value: 'Bearer token' }],
  protoFileId: 'proto-1',
  protoMethodName: 'UserService.List',
  reflectionApi: {}, // defaults
  ...overrides,
});

const makeWsRequest = (overrides: Record<string, unknown> = {}) => ({
  url: 'wss://ws.example',
  name: 'LiveFeed',
  meta: { id: 'ws-req-abc' },
  headers: [makeHeader()],
  parameters: [{ name: 'token', value: 'x' }],
  pathParameters: [{ name: 'roomId', value: '42' }],
  ...overrides,
});

const makeSocketIORequest = (overrides: Record<string, unknown> = {}) => ({
  url: 'https://socket.example',
  name: 'Rooms',
  meta: { id: 'socketio-req-abc' },
  headers: [makeHeader()],
  parameters: [{ name: 'ns', value: '/rooms' }],
  pathParameters: [{ name: 'roomId', value: '42' }],
  eventListeners: [{ id: 'ev1', eventName: 'join', desc: 'on join', isOpen: true }],
  ...overrides,
});

const makeGroup = (overrides: Record<string, unknown> = {}) => ({
  name: 'Root Group',
  meta: {
    id: 'group-1',
  },
  headers: [makeHeader()],
  ...overrides,
});

const makeMockRoute = (overrides: Record<string, unknown> = {}) => ({
  name: 'Ping',
  method: 'GET',
  mimeType: 'application/json',
  statusCode: 200,
  headers: [{ name: 'X-Mock', value: '1' }],
  body: '{"ok":true}',
  ...overrides,
});

// -----------------------------
// Primitive & Base Schemas
// -----------------------------
describe('LiteralSchema & KeyLiteralSchema', () => {
  it('accepts valid literals', () => {
    expect(LiteralSchema.parse('a')).toBe('a');
    expect(LiteralSchema.parse(1)).toBe(1);
    expect(LiteralSchema.parse(true)).toBe(true);
    expect(LiteralSchema.parse(null)).toBeNull();
    expect(KeyLiteralSchema.parse('k')).toBe('k');
    expect(KeyLiteralSchema.parse(7)).toBe(7);
  });
  it('rejects objects/functions for literal schemas', () => {
    expect(() => LiteralSchema.parse({})).toThrow();
    expect(() => KeyLiteralSchema.parse({})).toThrow();
  });
});

describe('JsonSchema', () => {
  it('accepts nested arrays and objects with literal keys', () => {
    const input = { a: [1, { b: true }, null], 3: 'ok' };
    expect(JsonSchema.parse(input)).toEqual(input);
  });
  it('rejects unsupported shapes (e.g., functions)', () => {
    expect(() => JsonSchema.parse({ bad: () => null })).toThrow();
  });
});

describe('MetaSchema & MetaGroupSchema', () => {
  it('MetaSchema requires id', () => {
    expect(() => MetaSchema.parse({})).toThrow();
    expect(MetaSchema.parse({ id: 'x' }).id).toBe('x');
  });
  it('MetaGroupSchema accepts description/optional fields', () => {
    const g = MetaGroupSchema.parse({ id: 'g1', description: 'd' });
    expect(g.id).toBe('g1');
    expect(g.description).toBe('d');
  });
});

describe('HeadersSchema', () => {
  it('valid header rows parse', () => {
    const h = HeadersSchema.parse([makeHeader(), { name: 'X-Id', value: '1', disabled: true }]);
    expect(h[1].disabled).toBe(true);
  });
  it('invalid header row is rejected', () => {
    expect(() => HeadersSchema.parse([{ value: 'x' }])).toThrow();
  });
});

// -----------------------------
// Cookie & Environment
// -----------------------------
describe('CookieJarSchema', () => {
  it('applies cookie defaults (path, secure, httpOnly, expires)', () => {
    const jar = CookieJarSchema.parse(makeCookieJar());
    expect(jar.cookies?.[0].path).toBe('/');
    expect(jar.cookies?.[0].secure).toBe(false);
    expect(jar.cookies?.[0].httpOnly).toBe(false);
    expect(jar.cookies?.[0].expires).toBeNull();
    // deterministic id thanks to polyfill
    expect(jar.cookies?.[0].id).toBeDefined();
  });
  it('coerces dates and preserves nullable expires', () => {
    const jar = CookieJarSchema.parse({
      name: 'jar',
      cookies: [{ expires: '2025-01-01T00:00:00Z' }],
    });
    expect(jar.cookies?.[0].expires).toBeInstanceOf(Date);
  });
});

describe('EnvironmentSchema', () => {
  it('parses root env and sub-environments', () => {
    const env = EnvironmentSchema.parse(makeEnvironment());
    expect(env.subEnvironments?.[0].name).toBe('Dev');
    expect(env.data).toBeDefined();
  });
  it('accepts null/optional color', () => {
    const env = EnvironmentSchema.parse(makeEnvironment({ color: null }));
    expect(env.color).toBeNull();
  });
});

// -----------------------------
// Authentication (union) deep coverage
// -----------------------------
describe('Authentication discriminated union', () => {
  const fromReq = (auth: unknown) =>
    RequestSchema.parse(makeHttpRequest({ authentication: auth })).authentication as any;

  it('basic', () => {
    const a = fromReq({ type: 'basic', username: 'u', password: 'p', useISO88591: true });
    expect(a.type).toBe('basic');
    expect(a.useISO88591).toBe(true);
  });

  it('apikey', () => {
    const a = fromReq({ type: 'apikey', key: 'k', value: 'v', addTo: 'header' });
    expect(a.type).toBe('apikey');
  });

  it('oauth2 (all grant types)', () => {
    const grants = ['authorization_code', 'client_credentials', 'implicit', 'password', 'refresh_token'] as const;
    for (const g of grants) {
      const a = fromReq({ type: 'oauth2', grantType: g, usePkce: true, responseType: 'code' });
      expect(a.grantType).toBe(g);
    }
  });

  it('hawk', () => {
    const a = fromReq({ type: 'hawk', id: 'id', key: 'k', algorithm: 'sha256', validatePayload: true });
    expect(a.algorithm).toBe('sha256');
  });

  it('oauth1', () => {
    const a = fromReq({ type: 'oauth1', signatureMethod: 'HMAC-SHA256', consumerKey: 'ck' });
    expect(a.signatureMethod).toBe('HMAC-SHA256');
  });

  it('digest', () => {
    const a = fromReq({ type: 'digest', username: 'u', password: 'p' });
    expect(a.type).toBe('digest');
  });

  it('ntlm', () => {
    const a = fromReq({ type: 'ntlm', username: 'u', password: 'p' });
    expect(a.type).toBe('ntlm');
  });

  it('bearer', () => {
    const a = fromReq({ type: 'bearer', token: 't', prefix: 'Bearer' });
    expect(a.prefix).toBe('Bearer');
  });

  it('iam', () => {
    const a = fromReq({ type: 'iam', accessKeyId: 'a', secretAccessKey: 's', region: 'eu-west-1' });
    expect(a.type).toBe('iam');
  });

  it('netrc', () => {
    const a = fromReq({ type: 'netrc' });
    expect(a.type).toBe('netrc');
  });

  it('asap (note: addintionalClaims spelling respected)', () => {
    const a = fromReq({
      type: 'asap',
      issuer: 'iss',
      subject: 'sub',
      audience: 'aud',
      addintionalClaims: '{"role":"admin"}',
      keyId: 'kid',
    });
    expect(a.type).toBe('asap');
    expect(a.addintionalClaims).toBe('{"role":"admin"}');
  });

  it('none', () => {
    const a = fromReq({ type: 'none' });
    expect(a.type).toBe('none');
  });

  it('singleToken', () => {
    const a = fromReq({ type: 'singleToken', token: 't' });
    expect(a.type).toBe('singleToken');
  });

  it('accepts empty object variant', () => {
    const a = fromReq({});
    expect(a).toEqual({});
  });
});

// -----------------------------
// Request settings & scripts
// -----------------------------
describe('RequestSchema settings & scripts', () => {
  it('applies defaults for RequestSettings', () => {
    const r = RequestSchema.parse(makeHttpRequest({ settings: undefined }));
    expect(r.settings?.encodeUrl).toBe(true);
    expect(r.settings?.cookies?.store).toBe(true);
    expect(r.settings?.followRedirects).toBe('global');
    expect(r.settings?.rebuildPath).toBe(true);
  });

  it('respects explicit settings', () => {
    const r = RequestSchema.parse(
      makeHttpRequest({
        settings: {
          renderRequestBody: false,
          encodeUrl: false,
          followRedirects: 'off',
          rebuildPath: false,
          cookies: { send: false, store: false },
        },
      }),
    );
    expect(r.settings?.encodeUrl).toBe(false);
    expect(r.settings?.cookies?.send).toBe(false);
    expect(r.settings?.followRedirects).toBe('off');
  });

  it('body params defaults', () => {
    const r = RequestSchema.parse(
      makeHttpRequest({
        method: 'POST',
        body: { params: [{}] },
      }),
    );
    expect(r.body?.params?.[0].name).toBe('');
    expect(r.body?.params?.[0].value).toBeUndefined();
  });
});

// -----------------------------
// Protocol request types
// -----------------------------
describe('GRPCRequestSchema', () => {
  it('parses minimal gRPC and applies reflection defaults', () => {
    const r = GRPCRequestSchema.parse(makeGrpcRequest({ metadata: undefined }));
    expect(r.reflectionApi.enabled).toBe(false);
    expect(r.reflectionApi.url).toBe('');
  });
});

describe('WebsocketRequestSchema', () => {
  it('parses ws and applies settings defaults', () => {
    const r = WebsocketRequestSchema.parse(makeWsRequest());
    expect(r.settings?.encodeUrl).toBe(true);
    expect(r.settings?.cookies?.store).toBe(true);
    expect(r.meta?.id.startsWith('ws-req')).toBe(true);
  });
});

describe('SocketIORequestSchema', () => {
  it('parses socket.io and applies defaults', () => {
    const r = SocketIORequestSchema.parse(makeSocketIORequest());
    expect(r.settings?.encodeUrl).toBe(true);
    expect(r.settings?.cookies?.send).toBe(true);
  });
});

// -----------------------------
// Request groups & recursion
// -----------------------------
describe('RequestGroupSchema', () => {
  it('parses group with headers', () => {
    const g = RequestGroupSchema.parse(makeGroup());
    expect(g.name).toBe('Root Group');
  });
});

describe('RequestCollectionSchema (recursive union)', () => {
  it('accepts mixed items and nested groups', () => {
    const collection = [
      makeHttpRequest(),
      makeGrpcRequest(),
      makeWsRequest(),
      makeSocketIORequest(),
      {
        ...makeGroup(),
        children: [
          makeHttpRequest({ name: 'Child HTTP' }),
          {
            ...makeGroup({ name: 'Nested Group' }),
            children: [makeHttpRequest({ name: 'Nested Child' })],
          },
        ],
      },
    ];
    const parsed = RequestCollectionSchema.parse(collection);
    expect(parsed).toHaveLength(5);
  });

  it('rejects leaf nodes with forbidden props (e.g., children on Request)', () => {
    const bad = structuredClone(makeHttpRequest());
    // @ts-expect-error - children is not allowed on Request
    bad.children = [];
    expect(() => RequestCollectionSchema.parse([bad])).toThrow();
  });
});

// -----------------------------
// Spec, Suites, Certificates, Mock Routes
// -----------------------------
describe('MockRouteSchema', () => {
  it('applies defaults and validates', () => {
    const r = MockRouteSchema.parse(makeMockRoute({ statusCode: undefined }));
    expect(r.statusCode).toBe(200);
  });
});

// -----------------------------
// Top-level documents
// -----------------------------
describe('CollectionSchema (top-level)', () => {
  it('parses collection with cookieJar, environments, certificates', () => {
    const col = CollectionSchema.parse({
      type: 'collection.insomnia.rest/5.0',
      name: 'My Collection',
      meta: makeMeta({ id: 'col-1' }),
      collection: [makeHttpRequest(), makeGrpcRequest()],
      cookieJar: makeCookieJar(),
      environments: makeEnvironment(),
      certificates: [{ path: '/etc/ssl/certs/ca.pem' }], // test defaults on CA cert
    });
    expect(col.collection?.length).toBe(2);
    expect(col.certificates?.[0].disabled).toBe(false);
  });
});

describe('ApiSpecSchema (top-level)', () => {
  it('parses spec with defaults and tests', () => {
    const spec = ApiSpecSchema.parse({
      type: 'spec.insomnia.rest/5.0',
      name: 'My API',
      spec: { contents: { openapi: '3.1.0' } },
      testSuites: [
        {
          name: 'Smoke',
          tests: [{ name: 'loads', requestId: null, code: '/* noop */' }],
        },
      ],
      certificates: [{}, {}],
    });
    // expect(spec.spec?.contents).toHaveProperty('openapi');
    expect(spec.testSuites?.[0].tests?.[0].requestId).toBeNull();
    expect(spec.certificates?.length).toBe(2);
  });
});

describe('MockServerSchema (top-level)', () => {
  it('parses mock server with routes', () => {
    const ms = MockServerSchema.parse({
      type: 'mock.insomnia.rest/5.0',
      name: 'MS',
      server: { url: 'https://mock.example', useInsomniaCloud: true },
      routes: [makeMockRoute()],
    });
    expect(ms.server?.url).toBe('https://mock.example');
    expect(ms.routes?.[0].statusCode).toBe(200);
  });
});

describe('InsomniaFileSchema (discriminated union)', () => {
  it('accepts collection variant', () => {
    const f = InsomniaFileSchema.parse({
      type: 'collection.insomnia.rest/5.0',
      collection: [makeHttpRequest()],
    });
    expect(f.type).toBe('collection.insomnia.rest/5.0');
  });

  it('accepts spec variant', () => {
    const f = InsomniaFileSchema.parse({
      type: 'spec.insomnia.rest/5.0',
      spec: { contents: {} },
    });
    expect(f.type).toBe('spec.insomnia.rest/5.0');
  });

  it('accepts mock server variant', () => {
    const f = InsomniaFileSchema.parse({
      type: 'mock.insomnia.rest/5.0',
      server: { url: 'https://mock' },
    });
    expect(f.type).toBe('mock.insomnia.rest/5.0');
  });

  it('rejects future or unsupported type', () => {
    expect(() => InsomniaFileSchema.parse({ type: 'futureCollection.insomnia.rest/5.0' })).toThrow();
  });

  it('rejects unknown type', () => {
    expect(() => InsomniaFileSchema.parse({ type: 'nope' })).toThrow();
  });
});

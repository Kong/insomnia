/**
 * Insomnia v5 Import Parser
 *
 * This module defines Zod schemas for parsing and validating Insomnia v5 export files.
 * It provides type-safe parsing of YAML files exported from Insomnia, ensuring data
 * integrity before importing into the database.
 *
 * Key responsibilities:
 * - Define Zod schemas for all v5 export types
 * - Validate imported data structure and types
 * - Provide TypeScript types for parsed data
 * - Handle different workspace scopes and request types
 *
 */

import { z } from 'zod/v4';

import { INSOMNIA_SCHEMA_VERSION } from '~/common/insomnia-schema-migrations/schema-version';

// This uses zod in order to ensure the parsed input matches our types before we insert it into the database

// Basic literal types that can appear in JSON data
export const LiteralSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);
export const KeyLiteralSchema = z.union([z.string(), z.number()]);

type Literal = z.infer<typeof LiteralSchema>;
type Json = Literal | { [key: string]: Json } | Json[];

// Recursive JSON schema that can handle nested objects and arrays
export const JsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([LiteralSchema, z.array(JsonSchema), z.record(KeyLiteralSchema, JsonSchema)]),
);

export const MetaSchema = z.object({
  id: z.string(),
  created: z.number().optional(),
  modified: z.number().optional(),
  isPrivate: z.boolean().optional(),
  description: z.string().optional(),
  sortKey: z.number().optional(),
});

export const MetaGroupSchema = z.object({
  id: z.string(),
  created: z.number().optional(),
  modified: z.number().optional(),
  isPrivate: z.boolean().optional(),
  sortKey: z.number().optional(),
  description: z.string().optional(),
});

export const HeadersSchema = z.array(
  z.object({
    name: z.string(),
    value: z.string(),
    description: z.string().optional(),
    disabled: z.boolean().optional(),
  }),
);

export type Meta = z.infer<typeof MetaSchema>;

const CACertificateSchema = z.object({
  path: z.string().optional().default(''),
  disabled: z.boolean().default(false),
  meta: MetaSchema.optional(),
});

const CookieSchema = z.object({
  id: z
    .string()
    .optional()
    .default(() => crypto.randomUUID()),
  key: z.string().optional().default(''),
  value: z.string().optional().default(''),
  expires: z.coerce.date().nullable().default(null),
  domain: z.string().optional().default(''),
  path: z.string().optional().default('/'),
  secure: z.boolean().optional().default(false),
  httpOnly: z.boolean().optional().default(false),
  extensions: z.array(JsonSchema).optional(),
  creation: z.coerce.date().optional(),
  creationIndex: z.number().optional(),
  hostOnly: z.boolean().optional(),
  pathIsDefault: z.boolean().optional(),
  lastAccessed: z.coerce.date().optional(),
});

export const CookieJarSchema = z.object({
  name: z.string().optional().default(''),
  meta: MetaSchema.optional(),
  cookies: z.array(CookieSchema).optional(),
});

export const EnvironmentSchema = z.object({
  name: z.string().optional(),
  meta: MetaSchema.optional(),
  data: JsonSchema.optional(),
  color: z.string().optional().nullable(),
  subEnvironments: z
    .array(
      z.object({
        name: z.string(),
        meta: MetaSchema.optional(),
        data: JsonSchema.optional(),
        dataPropertyOrder: JsonSchema.optional(),
        color: z.string().optional().nullable(),
      }),
    )
    .optional(),
  dataPropertyOrder: JsonSchema.optional(),
});

export const GRPCRequestSchema = z.object({
  url: z.string().optional().default(''),
  name: z.string().optional().default(''),
  meta: MetaSchema.optional(),
  body: z
    .object({
      text: z.string().optional(),
    })
    .optional(),
  metadata: z
    .array(
      z.object({
        name: z.string().optional().default(''),
        value: z.string().optional().default(''),
        description: z.string().optional(),
        disabled: z.boolean().optional(),
      }),
    )
    .optional(),
  protoFileId: z.string().optional().nullable(),
  protoMethodName: z.string().optional(),
  reflectionApi: z.object({
    enabled: z.boolean().optional().default(false),
    url: z.string().optional().default(''),
    apiKey: z.string().optional().default(''),
    module: z.string().optional().default(''),
  }),
});

export const MockRouteSchema = z.object({
  name: z.string().optional(),
  meta: MetaSchema.optional(),
  body: z.string().optional(),
  headers: z
    .array(
      z.object({
        name: z.string(),
        value: z.string(),
        description: z.string().optional(),
        disabled: z.boolean().optional(),
      }),
    )
    .optional(),
  method: z.string().optional(),
  mimeType: z.string().optional(),
  statusCode: z.number().optional().default(200),
  statusText: z.string().optional(),
});

const BasicAuthenticationSchema = z.object({
  type: z.literal('basic'),
  useISO88591: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  disabled: z.boolean().optional(),
});

const ApiKeyAuthenticationSchema = z.object({
  type: z.literal('apikey'),
  key: z.string().optional(),
  value: z.string().optional(),
  disabled: z.boolean().optional(),
  addTo: z.string().optional(),
});

const OAuth2AuthenticationSchema = z.object({
  type: z.literal('oauth2'),
  disabled: z.boolean().optional(),
  grantType: z.enum([
    'authorization_code',
    'client_credentials',
    'implicit',
    'password',
    'refresh_token',
    'mcp_auth_flow',
  ]),
  accessTokenUrl: z.string().optional(),
  authorizationUrl: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  audience: z.string().optional(),
  scope: z.string().optional(),
  resource: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  redirectUrl: z.string().optional(),
  useDefaultBrowser: z.boolean().optional(),
  credentialsInBody: z.boolean().optional(),
  state: z.string().optional(),
  code: z.string().optional(),
  accessToken: z.string().optional(),
  refreshToken: z.string().optional(),
  tokenPrefix: z.string().optional(),
  usePkce: z.boolean().optional(),
  pkceMethod: z.string().optional(),
  responseType: z.enum(['code', 'token', 'none', 'id_token', 'id_token token']).optional(),
  origin: z.string().optional(),
});

const HawkAuthenticationSchema = z.object({
  type: z.literal('hawk'),
  id: z.string().optional(),
  key: z.string().optional(),
  ext: z.string().optional(),
  validatePayload: z.boolean().optional(),
  algorithm: z.enum(['sha1', 'sha256']),
  disabled: z.boolean().optional(),
});

const OAuth1AuthenticationSchema = z.object({
  type: z.literal('oauth1'),
  disabled: z.boolean().optional(),
  signatureMethod: z.enum(['HMAC-SHA1', 'RSA-SHA1', 'HMAC-SHA256', 'PLAINTEXT']).optional(),
  consumerKey: z.string().optional(),
  tokenKey: z.string().optional(),
  tokenSecret: z.string().optional(),
  privateKey: z.string().optional(),
  version: z.string().optional(),
  nonce: z.string().optional(),
  timestamp: z.string().optional(),
  callback: z.string().optional(),
  realm: z.string().optional(),
  verifier: z.string().optional(),
  includeBodyHash: z.boolean().optional(),
});

const DigestAuthenticationSchema = z.object({
  type: z.literal('digest'),
  disabled: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

const NTLMAuthenticationSchema = z.object({
  type: z.literal('ntlm'),
  disabled: z.boolean().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
});

const BearerAuthenticationSchema = z.object({
  type: z.literal('bearer'),
  disabled: z.boolean().optional(),
  token: z.string().optional(),
  prefix: z.string().optional(),
});

const AWS_IAM_AuthenticationSchema = z.object({
  type: z.literal('iam'),
  disabled: z.boolean().optional(),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  sessionToken: z.string().optional(),
  region: z.string().optional(),
  service: z.string().optional(),
});

const NetrcAuthenticationSchema = z.object({
  type: z.literal('netrc'),
  disabled: z.boolean().optional(),
});

const ASAPAuthenticationSchema = z.object({
  type: z.literal('asap'),
  disabled: z.boolean().optional(),
  issuer: z.string().optional(),
  subject: z.string().optional(),
  audience: z.string().optional(),
  addintionalClaims: z.string().optional(),
  privateKey: z.string().optional(),
  keyId: z.string().optional(),
});

const NoneAuthenticationSchema = z.object({
  type: z.literal('none'),
  disabled: z.boolean().optional(),
});

const SingleTokenAuthenticationSchema = z.object({
  type: z.literal('singleToken'),
  disabled: z.boolean().optional(),
  token: z.string().optional(),
});

const AuthenticationSchema = z.union([
  z.discriminatedUnion('type', [
    BasicAuthenticationSchema,
    ApiKeyAuthenticationSchema,
    OAuth2AuthenticationSchema,
    HawkAuthenticationSchema,
    OAuth1AuthenticationSchema,
    DigestAuthenticationSchema,
    NTLMAuthenticationSchema,
    BearerAuthenticationSchema,
    AWS_IAM_AuthenticationSchema,
    NetrcAuthenticationSchema,
    ASAPAuthenticationSchema,
    NoneAuthenticationSchema,
    SingleTokenAuthenticationSchema,
  ]),
  z.object({}),
]);

export const ScriptsSchema = z.object({
  preRequest: z.string().optional(),
  afterResponse: z.string().optional(),
});

export const RequestSettingsSchema = z.object({
  renderRequestBody: z.boolean().default(true),
  encodeUrl: z.boolean().default(true),
  followRedirects: z.enum(['global', 'on', 'off']).default('global'),
  cookies: z.object({
    send: z.boolean().default(false),
    store: z.boolean().default(false),
  }),
  rebuildPath: z.boolean().default(true),
});

export const WebSocketRequestSettingsSchema = z.object({
  encodeUrl: z.boolean().optional().default(true),
  cookies: z.object({
    store: z.boolean().optional().default(true),
    send: z.boolean().optional().default(true),
  }),
  followRedirects: z.enum(['global', 'on', 'off']).optional().default('global'),
});

export const SocketIORequestSettingsSchema = z.object({
  encodeUrl: z.boolean().optional().default(true),
  cookies: z.object({
    store: z.boolean().optional().default(true),
    send: z.boolean().optional().default(true),
  }),
});

export const RequestPathParametersSchema = z.array(
  z.object({
    name: z.string().optional().default(''),
    value: z.string().optional().default(''),
  }),
);

const RequestParametersSchema = z.array(
  z.object({
    name: z.string().optional().default(''),
    value: z.string().optional().default(''),
    description: z.string().optional(),
    disabled: z.boolean().optional(),
    type: z.string().optional(),
    multiline: z.boolean().optional(),
  }),
);

export const RequestGroupSchema = z.object({
  name: z.string().optional().default(''),
  meta: MetaGroupSchema.optional(),
  children: z.array(z.any()).optional(),
  scripts: ScriptsSchema.optional(),
  authentication: AuthenticationSchema.optional().nullable(),
  environment: JsonSchema.optional(),
  environmentPropertyOrder: JsonSchema.optional(),
  headers: HeadersSchema.optional(),
});

export const RequestSchema = z.object({
  url: z.string().optional().default(''),
  name: z.string().optional().default(''),
  meta: MetaSchema.optional(),
  method: z.string(),
  body: z
    .object({
      mimeType: z.string().optional().nullable(),
      text: z.string().optional(),
      fileName: z.string().optional(),
      params: z
        .array(
          z.object({
            name: z.string().default(''),
            value: z.string().optional(),
            description: z.string().optional(),
            disabled: z.boolean().optional(),
            multiline: z.boolean().optional(),
            fileName: z.string().optional(),
            type: z.string().optional(),
          }),
        )
        .optional(),
    })
    .optional(),
  parameters: RequestParametersSchema.optional(),
  headers: HeadersSchema.optional(),
  authentication: AuthenticationSchema.optional(),
  scripts: ScriptsSchema.optional(),
  settings: RequestSettingsSchema.optional().default({
    renderRequestBody: true,
    encodeUrl: true,
    followRedirects: 'global',
    rebuildPath: true,
    cookies: {
      send: true,
      store: true,
    },
  }),
  pathParameters: RequestPathParametersSchema.optional().nullable(),
});

export const WebsocketRequestSchema = z.object({
  url: z.string().optional().default(''),
  name: z.string().optional().default(''),
  meta: MetaSchema.extend({
    id: z.string().startsWith('ws-req'),
  }).optional(),
  settings: WebSocketRequestSettingsSchema.optional().default({
    encodeUrl: true,
    followRedirects: 'global',
    cookies: {
      send: true,
      store: true,
    },
  }),
  authentication: AuthenticationSchema.optional(),
  headers: HeadersSchema.optional(),
  parameters: RequestParametersSchema.optional(),
  pathParameters: RequestPathParametersSchema.optional().nullable(),
});

export const SocketIOEventListenerSchema = z.object({
  id: z.string(),
  eventName: z.string().optional().default(''),
  desc: z.string().optional().default(''),
  isOpen: z.boolean().optional().default(false),
});

export const SocketIORequestSchema = z.object({
  url: z.string().optional().default(''),
  name: z.string().optional().default(''),
  meta: MetaSchema.extend({
    id: z.string().startsWith('socketio-req'),
  }).optional(),
  settings: SocketIORequestSettingsSchema.optional().default({
    encodeUrl: true,
    cookies: {
      send: true,
      store: true,
    },
  }),
  authentication: AuthenticationSchema.optional(),
  headers: HeadersSchema.optional(),
  parameters: RequestParametersSchema.optional(),
  pathParameters: RequestParametersSchema.optional(),
  eventListeners: SocketIOEventListenerSchema.array().optional(),
});

export const McpRequestSchema = z.object({
  name: z.string().optional().default(''),
  url: z.string().optional().default(''),
  transportType: z.enum(['stdio', 'streamable-http']).optional().default('streamable-http'),
  headers: HeadersSchema.optional(),
  authentication: AuthenticationSchema.optional(),
  meta: MetaSchema.optional(),
  env: z
    .array(
      z.object({
        id: z.string(),
        name: z.string().optional().default(''),
        value: z.string().optional().default(''),
        type: z.literal('str'),
        enabled: z.boolean().optional().default(true),
      }),
    )
    .optional(),
  roots: z
    .array(
      z.object({
        name: z.string().optional(),
        uri: z.string().optional().default(''),
      }),
    )
    .optional(),
});

type Request = z.infer<typeof RequestSchema>;
type GRPCRequest = z.infer<typeof GRPCRequestSchema>;
type WebsocketRequest = z.infer<typeof WebsocketRequestSchema>;
type SocketIORequest = z.infer<typeof SocketIORequestSchema>;
type RequestGroup = z.input<typeof RequestGroupSchema> & {
  children?: (Request | GRPCRequest | WebsocketRequest | RequestGroup | SocketIORequest)[];
};

const RequestGroupWithChildrenSchema: z.ZodType<RequestGroup> = RequestGroupSchema.extend({
  children: z.lazy(() => RequestCollectionSchema).optional(),
  // These undefined properties are added to differentiate between the different types of children in the union
  method: z.undefined(),
  url: z.undefined(),
  parameters: z.undefined(),
  pathParameters: z.undefined(),
});

export const RequestCollectionSchema = z
  .union([
    GRPCRequestSchema.extend({
      // These undefined properties are added to differentiate between the different types of children in the union
      children: z.undefined(),
      method: z.undefined(),
    }),
    RequestSchema.extend({
      // These undefined properties are added to differentiate between the different types of children in the union
      children: z.undefined(),
    }),
    WebsocketRequestSchema.extend({
      // These undefined properties are added to differentiate between the different types of children in the union
      children: z.undefined(),
      method: z.undefined(),
    }),
    SocketIORequestSchema.extend({
      // These undefined properties are added to differentiate between the different types of children in the union
      children: z.undefined(),
      method: z.undefined(),
    }),
    RequestGroupWithChildrenSchema,
  ])
  .array();

const TestSchema = z.object({
  name: z.string().optional().default(''),
  meta: MetaSchema.optional(),
  requestId: z.string().nullable().optional().default(null),
  code: z.string().optional().default(''),
});

const TestSuiteSchema = z.object({
  name: z.string().optional().default(''),
  meta: MetaSchema.optional(),
  tests: z.array(TestSchema).optional(),
});

const SpecSchema = z.union([
  z.object({
    file: z.string(),
    meta: MetaSchema.optional(),
  }),
  z.object({
    contents: JsonSchema.optional(),
    meta: MetaSchema.optional(),
  }),
]);

export const CollectionSchema = z.object({
  type: z.literal('collection.insomnia.rest/5.0'),
  schema_version: z.string().optional().default(INSOMNIA_SCHEMA_VERSION),
  name: z.string().optional(),
  meta: MetaSchema.optional(),
  collection: RequestCollectionSchema.optional(),
  cookieJar: CookieJarSchema.optional(),
  environments: EnvironmentSchema.optional(),
  certificates: z.array(CACertificateSchema).optional(),
});

export const ApiSpecSchema = z.object({
  type: z.literal('spec.insomnia.rest/5.0'),
  schema_version: z.string().optional().default(INSOMNIA_SCHEMA_VERSION),
  name: z.string().optional(),
  meta: MetaSchema.optional(),
  collection: RequestCollectionSchema.optional(),
  cookieJar: CookieJarSchema.optional(),
  environments: EnvironmentSchema.optional(),
  spec: SpecSchema.optional().default({ contents: {} }),
  testSuites: z.array(TestSuiteSchema).optional(),
  certificates: z.array(CACertificateSchema).optional(),
});

export const MockServerSchema = z.object({
  type: z.literal('mock.insomnia.rest/5.0'),
  schema_version: z.string().optional().default(INSOMNIA_SCHEMA_VERSION),
  name: z.string().optional(),
  meta: MetaSchema.optional(),
  server: z
    .object({
      meta: MetaSchema.optional(),
      url: z.string(),
      useInsomniaCloud: z.boolean().default(true),
    })
    .optional(),
  routes: z.array(MockRouteSchema).optional(),
});

const GlobalEnvironmentsSchema = z.object({
  type: z.literal('environment.insomnia.rest/5.0'),
  schema_version: z.string().optional().default(INSOMNIA_SCHEMA_VERSION),
  name: z.string().optional(),
  meta: MetaSchema.optional(),
  environments: EnvironmentSchema.optional(),
});

export const McpClientSchema = z.object({
  // Does not follow the insomnia.rest pattern to prevent crashes in older versions when syncing this file: INS-1762
  type: z.literal('mcpClient.insomnia/5.0'),
  schema_version: z.string().optional().default(INSOMNIA_SCHEMA_VERSION),
  name: z.string().optional(),
  meta: MetaSchema.optional(),
  mcpRequest: McpRequestSchema.optional(),
  environments: EnvironmentSchema.optional(),
});

export const InsomniaFileSchema = z.discriminatedUnion('type', [
  CollectionSchema,
  ApiSpecSchema,
  MockServerSchema,
  GlobalEnvironmentsSchema,
  McpClientSchema,
]);
export const InsomniaFileTypeValues = InsomniaFileSchema.options.map(option => option.shape.type.value);

export type InsomniaFile = z.infer<typeof InsomniaFileSchema>;

export type Insomnia_GRPCRequest = z.infer<typeof GRPCRequestSchema>;
export type Insomnia_RequestGroup = z.infer<typeof RequestGroupWithChildrenSchema>;
export type Insomnia_Request = z.infer<typeof RequestSchema>;
export type Insomnia_WebsocketRequest = z.infer<typeof WebsocketRequestSchema>;
export type Insomnia_SocketIORequest = z.infer<typeof SocketIORequestSchema>;
export type Insomnia_Meta = z.infer<typeof MetaSchema>;

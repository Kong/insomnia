import { z } from 'zod';

// This uses zod in order to ensure the parsed input matches our types before we insert it into the database

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

type Literal = z.infer<typeof literalSchema>;
type Json = Literal | { [key: string]: Json } | Json[];
const jsonSchema: z.ZodType<Json> = z.lazy(() =>
  z.union([literalSchema, z.array(jsonSchema), z.record(jsonSchema)])
);

const MetaSchema = z.object({
  id: z.string(),
  created: z.number().optional(),
  modified: z.number().optional(),
  isPrivate: z.boolean().optional(),
  description: z.string().optional(),
  sortKey: z.number().optional(),
});

export type Meta = z.infer<typeof MetaSchema>;

const CACertificateSchema = z.object({
  path: z.string(),
  disabled: z.boolean().default(false),
  meta: MetaSchema.optional(),
});

const CookieSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  expires: z.coerce.date().nullable().default(null),
  domain: z.string(),
  path: z.string(),
  secure: z.boolean().optional().default(false),
  httpOnly: z.boolean().optional().default(false),
  extensions: z.array(jsonSchema).optional(),
  creation: z.coerce.date().optional(),
  creationIndex: z.number().optional(),
  hostOnly: z.boolean().optional(),
  pathIsDefault: z.boolean().optional(),
  lastAccessed: z.coerce.date().optional(),
});

const CookieJarSchema = z.object({
  name: z.string(),
  cookies: z.array(CookieSchema).optional(),
  meta: MetaSchema.optional(),
});

const EnvironmentSchema = z.object({
  name: z.string().optional(),
  data: jsonSchema.optional(),
  dataPropertyOrder: jsonSchema.optional(),
  color: z.string().optional().nullable(),
  meta: MetaSchema.extend({
    sortKey: z.number().optional(),
  }).optional(),
  subEnvironments: z.array(z.object({
    name: z.string(),
    data: jsonSchema.optional(),
    dataPropertyOrder: jsonSchema.optional(),
    color: z.string().optional().nullable(),
    meta: MetaSchema.extend({
      sortKey: z.number().optional(),
    }).optional(),
  })).optional(),
});

export const GRPCRequestSchema = z.object({
  name: z.string(),
  url: z.string(),
  protoFileId: z.string().optional().nullable(),
  protoMethodName: z.string().optional(),
  body: z.object({
    text: z.string().optional(),
  }).optional(),
  metadata: z.array(z.object({
    name: z.string(),
    value: z.string(),
    description: z.string().optional(),
    disabled: z.boolean().optional(),
  })).optional(),
  reflectionApi: z.object({
    enabled: z.boolean().optional().default(false),
    url: z.string().optional().default(''),
    apiKey: z.string().optional().default(''),
    module: z.string().optional().default(''),
  }),
  meta: MetaSchema.extend({
    sortKey: z.number().optional(),
  }).optional(),
});

const MockRouteSchema = z.object({
  body: z.string(),
  statusCode: z.number(),
  statusText: z.string(),
  name: z.string(),
  mimeType: z.string(),
  method: z.string(),
  headers: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })),
  meta: MetaSchema.optional(),
});

const AuthenticationSchema = z.union([
  z.discriminatedUnion('type', [
    z.object({
      type: z.literal('basic'),
      useISO88591: z.boolean().default(false),
      username: z.string(),
      password: z.string(),
      disabled: z.boolean().default(false),
    }, {
      description: 'Basic Authentication',
    }),
    z.object({
      type: z.literal('apikey'),
      key: z.string().optional(),
      value: z.string().optional(),
      disabled: z.boolean().default(false),
      addTo: z.string().optional(),
    }, {
      description: 'API Key Authentication',
    }),
    z.object({
      type: z.literal('oauth2'),
      disabled: z.boolean().default(false),
      grantType: z.enum(['authorization_code', 'client_credentials', 'implicit', 'password', 'refresh_token']),
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
    }, {
      description: 'OAuth 2.0 Authentication',
    }),
    z.object({
      type: z.literal('hawk'),
      id: z.string(),
      key: z.string(),
      ext: z.string().optional(),
      validatePayload: z.boolean().optional(),
      algorithm: z.enum(['sha1', 'sha256']),
      disabled: z.boolean().default(false),
    }, {
      description: 'Hawk Authentication',
    }),
    z.object({
      type: z.literal('oauth1'),
      disabled: z.boolean().default(false),
      signatureMethod: z.enum(['HMAC-SHA1', 'RSA-SHA1', 'HMAC-SHA256', 'PLAINTEXT']),
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
    }, {
      description: 'OAuth 1.0 Authentication',
    }),
    z.object({
      type: z.literal('digest'),
      disabled: z.boolean().default(false),
      username: z.string(),
      password: z.string(),
    }, {
      description: 'Digest Authentication',
    }),
    z.object({
      type: z.literal('ntlm'),
      disabled: z.boolean().default(false),
      username: z.string(),
      password: z.string(),
    }, {
      description: 'NTLM Authentication',
    }),
    z.object({
      type: z.literal('bearer'),
      disabled: z.boolean().default(false),
      token: z.string().optional(),
      prefix: z.string().optional(),
    }, {
      description: 'Bearer Authentication',
    }),
    z.object({
      type: z.literal('iam'),
      disabled: z.boolean().default(false),
      accessKeyId: z.string().optional(),
      secretAccessKey: z.string().optional(),
      sessionToken: z.string().optional(),
      region: z.string().optional(),
      service: z.string().optional(),
    }, {
      description: 'AWS IAM Authentication',
    }),
    z.object({
      type: z.literal('netrc'),
      disabled: z.boolean().default(false),
    }, {
      description: 'Netrc Authentication',
    }),
    z.object({
      type: z.literal('asap'),
      disabled: z.boolean().default(false),
      issuer: z.string(),
      subject: z.string().optional(),
      audience: z.string(),
      addintionalClaims: z.string().optional(),
      privateKey: z.string(),
      keyId: z.string(),
    }, {
      description: 'ASAP Authentication',
    }),
    z.object({
      type: z.literal('none'),
      disabled: z.boolean().default(false),
    }, {
      description: 'No Authentication',
    }),
  ]),
  z.object({}),
]);

export const ScriptsSchema = z.object({
  preRequest: z.string().optional(),
  afterResponse: z.string().optional(),
});

export const RequestSettingsSchema = z.object({
  cookies: z.object({
    store: z.boolean().default(false),
    send: z.boolean().default(false),
  }),
  renderRequestBody: z.boolean().default(true),
  encodeUrl: z.boolean().default(true),
  rebuildPath: z.boolean().default(true),
  followRedirects: z.enum(['global', 'on', 'off']).default('global'),
});

export const WebSocketRequestSettingsSchema = z.object({
  encodeUrl: z.boolean().default(true),
  cookies: z.object({
    store: z.boolean().default(true),
    send: z.boolean().default(true),
  }),
  followRedirects: z.enum(['global', 'on', 'off']).default('global'),
});

export const RequestParametersSchema = z.array(z.object({
  name: z.string(),
  value: z.string(),
}));

export const RequestHeadersSchema = z.array(z.object({
  name: z.string(),
  value: z.string(),
}));

export const RequestGroupSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  environment: jsonSchema.optional(),
  environmentPropertyOrder: jsonSchema.optional(),
  scripts: ScriptsSchema.optional(),
  authentication: AuthenticationSchema.optional(),
  headers: RequestHeadersSchema.optional(),
  meta: MetaSchema.extend({
    sortKey: z.number().optional(),
  }).optional(),
});

export const RequestSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  url: z.string(),
  method: z.string(),
  body: z.object({
    mimeType: z.string().optional().nullable(),
    text: z.string().optional(),
    fileName: z.string().optional(),
    params: z.array(z.object({
      name: z.string(),
      value: z.string(),
      description: z.string().optional(),
      disabled: z.boolean().optional(),
      multiline: z.string().optional(),
      id: z.string().optional(),
      fileName: z.string().optional(),
      type: z.string().optional(),
    })).optional(),
  }).optional(),
  headers: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })).optional(),
  parameters: z.array(z.object({
    name: z.string(),
    value: z.string(),
    disabled: z.boolean().optional(),
    id: z.string().optional(),
    fileName: z.string().optional(),
  })).optional(),
  pathParameters: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })).optional(),
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
  meta: MetaSchema.extend({
    sortKey: z.number().optional(),
  }).optional(),
});

export const WebsocketRequestSchema = z.object({
  name: z.string(),
  url: z.string(),
  headers: RequestHeadersSchema.optional(),
  authentication: AuthenticationSchema.optional(),
  parameters: RequestParametersSchema.optional(),
  pathParameters: RequestParametersSchema.optional(),
  settings: WebSocketRequestSettingsSchema.optional().default({
    encodeUrl: true,
    followRedirects: 'global',
    cookies: {
      send: true,
      store: true,
    },
  }),
  meta: MetaSchema.extend({
    sortKey: z.number().optional(),
  }).optional(),
});

type Request = z.infer<typeof RequestSchema>;
type GRPCRequest = z.infer<typeof GRPCRequestSchema>;
type WebsocketRequest = z.infer<typeof WebsocketRequestSchema>;
type RequestGroup = z.infer<typeof RequestGroupSchema> & {
  children?: (Request | GRPCRequest | WebsocketRequest | RequestGroup)[];
};

const RequestGroupWithChildrenSchema: z.ZodType<RequestGroup> = RequestGroupSchema.extend({
  children: z.lazy(() => z.union([GRPCRequestSchema, RequestSchema, WebsocketRequestSchema, RequestGroupWithChildrenSchema]).array()).optional(),
});

const TestSchema = z.object({
  name: z.string(),
  code: z.string(),
  requestId: z.string().nullable(),
  meta: MetaSchema.extend({
    sortKey: z.number().optional(),
  }).optional(),
});

const TestSuiteSchema = z.object({
  name: z.string(),
  meta: MetaSchema.extend({
    sortKey: z.number().optional(),
  }).optional(),
  tests: z.array(TestSchema).optional(),
});

const SpecSchema = z.union([z.object({
  meta: MetaSchema.optional(),
  file: z.string(),
}), z.object({
  meta: MetaSchema.optional(),
  contents: jsonSchema,
})]);

const collectionSchema = z.object({
  type: z.literal('collection.insomnia.rest/5.0'),
  meta: MetaSchema.optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  collection: z.union([GRPCRequestSchema, RequestSchema, WebsocketRequestSchema, RequestGroupWithChildrenSchema]).array().optional(),
  certificates: z.array(CACertificateSchema).optional(),
  environments: EnvironmentSchema.optional(),
  cookieJar: CookieJarSchema.optional(),
});

const apiSpecSchema = z.object({
  type: z.literal('spec.insomnia.rest/5.0'),
  meta: MetaSchema.optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  spec: SpecSchema.optional().default({ contents: {} }),
  collection: z.union([GRPCRequestSchema, RequestSchema, WebsocketRequestSchema, RequestGroupWithChildrenSchema]).array().optional(),
  certificates: z.array(CACertificateSchema).optional(),
  environments: EnvironmentSchema.optional(),
  cookieJar: CookieJarSchema.optional(),
  testSuites: z.array(TestSuiteSchema).optional(),
});

const mockServerSchema = z.object({
  type: z.literal('mock.insomnia.rest/5.0'),
  meta: MetaSchema.optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  url: z.string(),
  useInsomniaCloud: z.boolean().default(true),
  routes: z.array(MockRouteSchema).optional(),
});

const globalEnvironmentsSchema = z.object({
  type: z.literal('environment.insomnia.rest/5.0'),
  meta: MetaSchema.optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  environments: EnvironmentSchema.optional(),
});

export const insomniaFileSchema = z.discriminatedUnion('type', [
  collectionSchema,
  apiSpecSchema,
  mockServerSchema,
  globalEnvironmentsSchema,
]);

export type InsomniaFile = z.infer<typeof insomniaFileSchema>;

export type Z_GRPCRequest = z.infer<typeof GRPCRequestSchema>;
export type Z_RequestGroup = z.infer<typeof RequestGroupWithChildrenSchema>;
export type Z_Request = z.infer<typeof RequestSchema>;
export type Z_WebsocketRequest = z.infer<typeof WebsocketRequestSchema>;

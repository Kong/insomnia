import { writeFile } from 'fs/promises';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

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
});

const CACertificateSchema = z.object({
  path: z.string(),
  disabled: z.boolean().default(false),
  meta: MetaSchema.optional(),
});

// const ClientCertificateSchema = z.object({
//   host: z.string(),
//   passphrase: z.string().nullable(),
//   cert: z.string().nullable(),
//   key: z.string().nullable(),
//   pfx: z.string().nullable(),
//   disabled: z.boolean().default(false),
//   meta: MetaSchema.optional(),
// });

const CookieSchema = z.object({
  id: z.string(),
  key: z.string(),
  value: z.string(),
  expires: z.union([z.date(), z.string(), z.number(), z.null()]),
  domain: z.string(),
  path: z.string(),
  secure: z.boolean(),
  httpOnly: z.boolean(),
  extensions: z.array(jsonSchema),
  creation: z.date().nullable(),
  creationIndex: z.number().nullable(),
  hostOnly: z.boolean().nullable(),
  pathIsDefault: z.boolean().nullable(),
  lastAccessed: z.date().nullable(),
});

const CookieJarSchema = z.object({
  type: z.literal('CookieJar'),
  name: z.string(),
  cookies: z.array(CookieSchema).optional(),
  meta: MetaSchema.optional(),
});

const EnvironmentSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  data: jsonSchema,
  color: z.string().optional(),
  meta: MetaSchema.optional(),
});

// const GitRepositorySchema = z.object({
//   type: z.literal('GitRepository'),
//   needsFullClone: z.boolean().default(false),
//   uriNeedsMigration: z.boolean().default(true),
//   uri: z.string(),
//   credentials: z.union([
//     z.object({
//       username: z.string(),
//       password: z.string(),
//     }).nullable(),
//     z.object({
//       oauth2format: z.enum(['github', 'gitlab']).optional(),
//       username: z.string(),
//       token: z.string(),
//     }),
//   ]),
//   author: z.object({
//     name: z.string(),
//     email: z.string(),
//   }),
//   meta: MetaSchema,
// });

const GRPCRequestSchema = z.object({
  name: z.string(),
  url: z.string(),
  description: z.string().optional(),
  protoFileId: z.string().optional().nullable(),
  protoMethodName: z.string().optional(),
  body: z.object({
    text: z.string().nullable(),
  }).optional(),
  metadata: z.array(z.object({
    name: z.string(),
    value: z.string(),
    description: z.string().nullable(),
    disabled: z.boolean().nullable(),
  })).optional(),
  metaSortKey: z.number().optional(),
  isPrivate: z.boolean().default(false).optional(),
  reflectionApi: z.object({
    enabled: z.boolean(),
    url: z.string(),
    apiKey: z.string(),
    module: z.string(),
  }).optional(),
  meta: MetaSchema.optional(),
});

// const OAuth2TokenSchema = z.object({
//   meta: MetaSchema,
//   type: z.literal('OAuth2Token'),
//   accessToken: z.string(),
//   refreshToken: z.string(),
//   identityToken: z.string(),
//   expiresAt: z.number().nullable(),
//   xResponseId: z.string().nullable(),
//   xError: z.string().nullable(),
//   error: z.string(),
//   errorDescription: z.string(),
//   errorUri: z.string(),
// });

const MockRouteSchema = z.object({
  type: z.literal('MockRoute'),
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
  meta: MetaSchema,
});

// const ProtoDirectorySchema = z.object({
//   type: z.literal('ProtoDirectory'),
//   name: z.string(),
//   meta: MetaSchema,
// });

// const ProtoFileSchema = z.object({
//   type: z.literal('ProtoFile'),
//   name: z.string(),
//   protoText: z.string(),
//   meta: MetaSchema,
// });

const AuthenticationSchema = z.union([
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
]);

const RequestGroupSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  environment: jsonSchema.optional(),
  environmentPropertyOrder: jsonSchema.optional(),
  metaSortKey: z.number().optional(),
  preRequestScript: z.string().optional(),
  afterResponseScript: z.string().optional(),
  authentication: AuthenticationSchema.optional(),
  headers: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })).optional(),
  meta: MetaSchema.optional(),
});

const RequestSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  url: z.string(),
  method: z.string(),
  body: z.object({
    mimeType: z.string().optional(),
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
  preRequestScript: z.string().optional(),
  afterResponseScript: z.string().optional(),
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
  metaSortKey: z.number().optional(),
  isPrivate: z.boolean().default(false).optional(),
  settingStoreCookies: z.boolean().default(false),
  settingSendCookies: z.boolean().default(false),
  settingDisableRenderRequestBody: z.boolean().default(false),
  settingEncodeUrl: z.boolean().default(true),
  settingRebuildPath: z.boolean().default(true),
  settingFollowRedirects: z.enum(['global', 'on', 'off']).default('global'),
  meta: MetaSchema.optional(),
});

const WebsocketRequestSchema = z.object({
  name: z.string(),
  url: z.string(),
  description: z.string().optional(),
  metaSortKey: z.number().optional(),
  headers: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })).optional(),
  authentication: AuthenticationSchema.optional(),
  parameters: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })).optional(),
  pathParameters: z.array(z.object({
    name: z.string(),
    value: z.string(),
  })).optional(),
  settingEncodeUrl: z.boolean().default(true),
  settingStoreCookies: z.boolean().default(true),
  settingSendCookies: z.boolean().default(true),
  settingFollowRedirects: z.enum(['global', 'on', 'off']).default('global'),
  meta: MetaSchema.optional(),
});

type Request = z.infer<typeof RequestSchema>;
type GRPCRequest = z.infer<typeof GRPCRequestSchema>;
type WebsocketRequest = z.infer<typeof WebsocketRequestSchema>;
type RequestGroup = z.infer<typeof RequestGroupSchema> & {
  children: (Request | GRPCRequest | WebsocketRequest | RequestGroup)[];
};

const RequestGroupWithChildrenSchema: z.ZodType<RequestGroup> = RequestGroupSchema.extend({
  children: z.lazy(() => z.union([RequestSchema, GRPCRequestSchema, WebsocketRequestSchema, RequestGroupWithChildrenSchema]).array()).optional(),
});

const TestSchema = z.object({
  name: z.string(),
  code: z.string(),
  requestId: z.string().nullable().optional(),
  metaSortKey: z.number().optional(),
  meta: MetaSchema.optional(),
});

const TestSuiteSchema = z.object({
  name: z.string(),
  metaSortKey: z.number().optional(),
  meta: MetaSchema.optional(),
  tests: z.array(TestSchema).optional(),
});

const SpecSchema = z.union([z.object({
  file: z.string(),
}), z.object({
  contents: jsonSchema,
})]);

const collectionSchema = z.object({
  type: z.literal('collection.insomnia.rest/5.0'),
  meta: MetaSchema.optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  collection: z.union([RequestSchema, GRPCRequestSchema, RequestGroupWithChildrenSchema]).array(),
  certificates: z.array(CACertificateSchema).optional(),
  environments: z.array(EnvironmentSchema).optional(),
  cookieJar: CookieJarSchema.optional(),
});

const apiSpecSchema = z.object({
  type: z.literal('spec.insomnia.rest/5.0'),
  meta: MetaSchema.optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  spec: SpecSchema.optional(),
  collection: z.union([RequestSchema, GRPCRequestSchema, RequestGroupWithChildrenSchema]).array(),
  certificates: z.array(CACertificateSchema).optional(),
  environments: z.array(EnvironmentSchema).optional(),
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
  environments: z.array(EnvironmentSchema),
});

const insomniaFileSchema = z.union([collectionSchema, apiSpecSchema, mockServerSchema, globalEnvironmentsSchema]);

writeFile('collection-schema.json', JSON.stringify(zodToJsonSchema(insomniaFileSchema), null, 2));

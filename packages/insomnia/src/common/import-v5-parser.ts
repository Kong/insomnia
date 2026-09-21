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
import { models } from 'insomnia-data';
import { z } from 'zod/v4';

import { INSOMNIA_SCHEMA_VERSION } from '~/common/insomnia-schema-migrations/schema-version';
import { JsonSchema } from '~/common/zod/base-schemas';

// This uses zod in order to ensure the parsed input matches our types before we insert it into the database

const {
  environment,
  mockServer,
  mockRoute,
  unitTest,
  unitTestSuite,
  caCertificate,
  cookieJar,
  requestGroup,
  request,
  grpcRequest,
  webSocketRequest,
  socketIORequest,
  mcpRequest,
} = models;

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

const CACertificateSchema = caCertificate.baseCACertificateSchema.omit({ parentId: true }).extend({
  meta: MetaSchema.optional(),
});

export const CookieJarSchema = cookieJar.baseCookieJarSchema.extend({
  meta: MetaSchema.optional(),
});

const baseEnvironmentSchema = environment.baseEnvironmentSchema.omit({ metaSortKey: true }).extend({
  meta: MetaSchema.optional(),
});
export const EnvironmentSchema = baseEnvironmentSchema.extend({
  subEnvironments: z.array(baseEnvironmentSchema).optional(),
});

export const GRPCRequestSchema = grpcRequest.baseGrpcRequestSchema
  .omit({ description: true, metaSortKey: true })
  .extend({
    meta: MetaSchema.extend({
      id: z.string().startsWith('greq'),
    }).optional(),
    body: grpcRequest.baseGrpcRequestSchema.shape.body.optional(),
    metadata: grpcRequest.baseGrpcRequestSchema.shape.metadata.optional(),
  });

export const MockRouteSchema = mockRoute.baseMockRouteSchema.omit({ parentId: true }).extend({
  meta: MetaSchema.optional(),
});
const baseMockServerSchema = mockServer.baseMockServerSchema.omit({ parentId: true, name: true }).extend({
  meta: MetaSchema.optional(),
});

export const RequestSettingsSchema = request.baseRequestSettingsSchema.transform(data => ({
  renderRequestBody: !data.settingDisableRenderRequestBody,
  encodeUrl: data.settingEncodeUrl,
  followRedirects: data.settingFollowRedirects,
  cookies: {
    send: data.settingSendCookies,
    store: data.settingStoreCookies,
  },
  rebuildPath: data.settingRebuildPath,
}));

export const WebSocketRequestSettingsSchema = webSocketRequest.baseWebSocketRequestSettingsSchema.transform(data => ({
  encodeUrl: data.settingEncodeUrl,
  cookies: {
    send: data.settingSendCookies,
    store: data.settingStoreCookies,
  },
  followRedirects: data.settingFollowRedirects,
  // TODO add this settings support
  useProxy: data.settingUseProxy,
}));

export const SocketIORequestSettingsSchema = socketIORequest.baseSocketIORequestSettingsSchema.transform(data => ({
  encodeUrl: data.settingEncodeUrl,
  cookies: {
    send: data.settingSendCookies,
    store: data.settingStoreCookies,
  },
  path: data.settingPath,
}));

export const RequestGroupSchema = requestGroup.baseRequestGroupSchema
  .omit({ description: true, metaSortKey: true, preRequestScript: true, afterResponseScript: true })
  .extend({
    meta: MetaGroupSchema.extend({
      id: z.string().startsWith('fld'),
    }).optional(),
    children: z.array(z.any()).optional(),
    scripts: z
      .object({
        preRequest: requestGroup.baseRequestGroupSchema.shape.preRequestScript,
        afterResponse: requestGroup.baseRequestGroupSchema.shape.afterResponseScript,
      })
      .optional(),
  });

export const RequestSchema = request.baseRequestSchema
  .omit({ description: true, metaSortKey: true, preRequestScript: true, afterResponseScript: true })
  .extend({
    meta: MetaSchema.extend({
      id: z.string().startsWith('req'),
    }).optional(),
    scripts: z
      .object({
        preRequest: request.schema.shape.preRequestScript,
        afterResponse: request.schema.shape.afterResponseScript,
      })
      .optional(),
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
  });

export const WebsocketRequestSchema = webSocketRequest.baseWebSocketRequestSchema
  .omit({
    description: true,
    metaSortKey: true,
  })
  .extend({
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
      useProxy: false,
    }),
  });

export const SocketIORequestSchema = socketIORequest.baseSocketIORequestSchema
  .omit({
    description: true,
    metaSortKey: true,
  })
  .extend({
    meta: MetaSchema.extend({
      id: z.string().startsWith('socketio-req'),
    }).optional(),
    settings: SocketIORequestSettingsSchema.optional().default({
      encodeUrl: true,
      cookies: {
        send: true,
        store: true,
      },
      path: undefined,
    }),
  });

export const McpRequestSchema = mcpRequest.baseMcpRequestSchema.omit({ description: true }).extend({
  name: z.string().optional().default(''),
  meta: MetaSchema.extend({
    id: z.string().startsWith('mcp-req'),
  }).optional(),
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

const TestSchema = unitTest.BaseUnitTestSchema.omit({ metaSortKey: true }).extend({
  meta: MetaSchema.optional(),
});

const TestSuiteSchema = unitTestSuite.baseUnitTestSuiteSchema.omit({ metaSortKey: true }).extend({
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
  testSuites: z.array(TestSuiteSchema).optional(),
  spec: SpecSchema.optional(),
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
  server: baseMockServerSchema.optional(),
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

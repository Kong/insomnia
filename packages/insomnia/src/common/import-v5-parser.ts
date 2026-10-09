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

const { parentId: caCertificateParentIdShape, ...restCaCertificateSchemaShape } =
  caCertificate.baseCACertificateSchema.shape;
const CACertificateSchema = z.object({
  ...restCaCertificateSchemaShape,
  meta: MetaSchema.optional(),
});

const { name: cookieJarNameShape, ...restCookieJarSchemaShape } = cookieJar.baseCookieJarSchema.shape;
export const CookieJarSchema = z.object({
  name: cookieJarNameShape,
  meta: MetaSchema.optional(),
  ...restCookieJarSchemaShape,
});

// Keep the key order consistent so that export to YAML maintains the same order as the model's shape
const { name, data, color, dataPropertyOrder, ...rest } = environment.baseEnvironmentSchema.omit({
  metaSortKey: true,
}).shape;
export const EnvironmentSchema = z.object({
  name,
  meta: MetaSchema.optional(),
  data,
  color,
  subEnvironments: z
    .array(
      z.object({
        name,
        meta: MetaSchema.optional(),
        data,
        dataPropertyOrder,
        color,
        ...rest,
      }),
    )
    .optional(),
  dataPropertyOrder,
  ...rest,
});

const {
  url: grpcRequestUrlShape,
  name: grpcRequestNameShape,
  body: grpcRequestBodyShape,
  metadata: grpcRequestMetadataShape,
  // description and metaSortKey are not needed in the GRPCRequestSchema
  description: _grpcRequestDescriptionShape,
  metaSortKey: _grpcRequestMetaSortKeyShape,
  ...restGrpcRequestSchemaShape
} = grpcRequest.baseGrpcRequestSchema.shape;
export const GRPCRequestSchema = z.object({
  url: grpcRequestUrlShape,
  name: grpcRequestNameShape,
  meta: MetaSchema.extend({
    id: z.string().startsWith('greq'),
  }).optional(),
  body: grpcRequestBodyShape.optional(),
  metadata: grpcRequestMetadataShape.optional(),
  ...restGrpcRequestSchemaShape,
});

// parentId do not need to be included in the MockRouteSchema
const {
  name: mockRouteNameShape,
  parentId: mockRouteParentIdShape,
  ...mockRouteShapeRest
} = mockRoute.baseMockRouteSchema.shape;
export const MockRouteSchema = z.object({
  name: mockRouteNameShape,
  meta: MetaSchema.optional(),
  ...mockRouteShapeRest,
});
// parentId and name do not need to be included in the MockServerSchema
const {
  name: mockServerNameShape,
  parentId: mockServerParentIdShape,
  ...mockServerShapeRest
} = mockServer.baseMockServerSchema.shape;
const baseMockServerSchema = z.object({
  meta: MetaSchema.optional(),
  ...mockServerShapeRest,
});

const requestSettingsShape = request.baseRequestSettingsSchema.shape;
export const RequestSettingsSchema = z.object({
  renderRequestBody: z.boolean().default(true),
  encodeUrl: requestSettingsShape.settingEncodeUrl,
  followRedirects: requestSettingsShape.settingFollowRedirects,
  cookies: z.object({
    send: requestSettingsShape.settingSendCookies,
    store: requestSettingsShape.settingStoreCookies,
  }),
  rebuildPath: requestSettingsShape.settingRebuildPath,
});

const webSocketRequestSettingsShape = webSocketRequest.baseWebSocketRequestSettingsSchema.shape;
export const WebSocketRequestSettingsSchema = z.object({
  encodeUrl: webSocketRequestSettingsShape.settingEncodeUrl,
  cookies: z.object({
    store: webSocketRequestSettingsShape.settingStoreCookies,
    send: webSocketRequestSettingsShape.settingSendCookies,
  }),
  followRedirects: webSocketRequestSettingsShape.settingFollowRedirects,
  // TODO add this settings support
  useProxy: webSocketRequestSettingsShape.settingUseProxy,
});

const socketIORequestSettingsShape = socketIORequest.baseSocketIORequestSettingsSchema.shape;
export const SocketIORequestSettingsSchema = z.object({
  encodeUrl: socketIORequestSettingsShape.settingEncodeUrl,
  cookies: z.object({
    store: socketIORequestSettingsShape.settingStoreCookies,
    send: socketIORequestSettingsShape.settingSendCookies,
  }),
  path: socketIORequestSettingsShape.settingPath,
});

const {
  name: requestGroupNameShape,
  description: requestGroupDescriptionShape,
  metaSortKey: requestGroupMetaSortKeyShape,
  preRequestScript: requestGroupPreRequestScriptShape,
  afterResponseScript: requestGroupAfterResponseScriptShape,
  ...restRequestGroupSchemaShape
} = requestGroup.baseRequestGroupSchema.shape;
export const RequestGroupSchema = z.object({
  name: requestGroupNameShape,
  meta: MetaGroupSchema.extend({
    id: z.string().startsWith('fld'),
  }).optional(),
  children: z.array(z.any()).optional(),
  scripts: z
    .object({
      preRequest: requestGroupPreRequestScriptShape,
      afterResponse: requestGroupAfterResponseScriptShape,
    })
    .optional(),
  ...restRequestGroupSchemaShape,
});

const {
  url: requestUrlShape,
  name: requestNameShape,
  description: requestDescriptionShape,
  metaSortKey: requestMetaSortKeyShape,
  pathParameters: requestPathParametersShape,
  preRequestScript: requestPreRequestScriptShape,
  afterResponseScript: requestAfterResponseScriptShape,
  ...restRequestSchemaShape
} = request.baseRequestSchema.shape;
export const RequestSchema = z.object({
  url: requestUrlShape,
  name: requestNameShape,
  meta: MetaSchema.extend({
    id: z.string().startsWith('req'),
  }).optional(),
  ...restRequestSchemaShape,
  scripts: z
    .object({
      preRequest: requestPreRequestScriptShape,
      afterResponse: requestAfterResponseScriptShape,
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
  pathParameters: requestPathParametersShape.nullable(),
});

const {
  url: webSocketRequestUrlShape,
  name: webSocketRequestNameShape,
  description: webSocketRequestDescriptionShape,
  metaSortKey: webSocketRequestMetaSortKeyShape,
  pathParameters: webSocketRequestPathParametersShape,
  ...restWebSocketRequestSchemaShape
} = webSocketRequest.baseWebSocketRequestSchema.shape;
export const WebsocketRequestSchema = z.object({
  url: webSocketRequestUrlShape,
  name: webSocketRequestNameShape,
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
  ...restWebSocketRequestSchemaShape,
  pathParameters: webSocketRequestPathParametersShape.nullable(),
});

const {
  url: socketIORequestUrlShape,
  name: socketIORequestNameShape,
  description: socketIORequestDescriptionShape,
  metaSortKey: socketIORequestMetaSortKeyShape,
  ...restSocketIORequestSchemaShape
} = socketIORequest.baseSocketIORequestSchema.shape;
export const SocketIORequestSchema = z.object({
  url: socketIORequestUrlShape,
  name: socketIORequestNameShape,
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
  ...restSocketIORequestSchemaShape,
});

// Keep the key order consistent so that export to YAML maintains the same order as before: meta sits after authentication
const {
  description: mcpRequestDescription,
  url: mcpRequestUrl,
  transportType: mcpRequestTransportType,
  headers: mcpRequestHeaders,
  authentication: mcpRequestAuthentication,
  ...restMcpRequestShape
} = mcpRequest.baseMcpRequestSchema.shape;
export const McpRequestSchema = z.object({
  name: z.string().optional().default(''),
  url: mcpRequestUrl,
  transportType: mcpRequestTransportType,
  headers: mcpRequestHeaders,
  authentication: mcpRequestAuthentication,
  meta: MetaSchema.extend({
    id: z.string().startsWith('mcp-req'),
  }).optional(),
  ...restMcpRequestShape,
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

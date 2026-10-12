import { z } from 'zod/v4';

export const allTypesSchema = z.enum([
  'ApiSpec',
  'CaCertificate',
  'ClientCertificate',
  'CloudCredential',
  'CookieJar',
  'Environment',
  'GitCredentials',
  'GitRepository',
  'GrpcRequest',
  'GrpcRequestMeta',
  'MockRoute',
  'MockServer',
  'OAuth2Token',
  'PluginData',
  'Project',
  'ProjectLintRuleset',
  'ProtoDirectory',
  'ProtoFile',
  'Request',
  'RequestGroup',
  'RequestGroupMeta',
  'RequestMeta',
  'RequestVersion',
  'Response',
  'RunnerTestResult',
  'Settings',
  'SocketIOPayload',
  'SocketIORequest',
  'SocketIOResponse',
  'SocketIORequestMeta',
  'Stats',
  'UnitTest',
  'UnitTestResult',
  'UnitTestSuite',
  'UserSession',
  'WebSocketPayload',
  'WebSocketRequest',
  'WebSocketResponse',
  'WebSocketRequestMeta',
  'McpRequest',
  'McpResponse',
  'McpPayload',
  'Workspace',
  'WorkspaceMeta',
]);

export type AllTypes = z.infer<typeof allTypesSchema>;

export const baseModelSchema = z.object({
  _id: z.string(),
  type: allTypesSchema,
  // TSCONVERSION -- parentId is always required for all models, except 4:
  //   - Stats, Settings, and Project, which never have a parentId
  //   - Workspace optionally has a parentId (which will be the id of a Project)
  parentId: z.string(),
  modified: z.number(),
  created: z.number(),
  isPrivate: z.boolean(),
  name: z.string(),
});

export type BaseModel = z.infer<typeof baseModelSchema>;

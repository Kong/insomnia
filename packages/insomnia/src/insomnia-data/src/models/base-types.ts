export type AllTypes =
  | 'ApiSpec'
  | 'CaCertificate'
  | 'ClientCertificate'
  | 'CloudCredential'
  | 'CookieJar'
  | 'Environment'
  | 'GitCredentials'
  | 'GitRepository'
  | 'GrpcRequest'
  | 'GrpcRequestMeta'
  | 'MockRoute'
  | 'MockServer'
  | 'OAuth2Token'
  | 'PluginData'
  | 'Project'
  | 'ProtoDirectory'
  | 'ProtoFile'
  | 'Request'
  | 'RequestGroup'
  | 'RequestGroupMeta'
  | 'RequestMeta'
  | 'RequestVersion'
  | 'Response'
  | 'RunnerTestResult'
  | 'Settings'
  | 'SocketIOPayload'
  | 'SocketIORequest'
  | 'SocketIOResponse'
  | 'SocketIORequestMeta'
  | 'Stats'
  | 'UnitTest'
  | 'UnitTestResult'
  | 'UnitTestSuite'
  | 'UserSession'
  | 'WebSocketPayload'
  | 'WebSocketRequest'
  | 'WebSocketResponse'
  | 'WebSocketRequestMeta'
  | 'McpRequest'
  | 'McpResponse'
  | 'McpPayload'
  | 'Workspace'
  | 'WorkspaceMeta';

export interface BaseModel {
  _id: string;
  type: AllTypes;
  // TSCONVERSION -- parentId is always required for all models, except 4:
  //   - Stats, Settings, and Project, which never have a parentId
  //   - Workspace optionally has a parentId (which will be the id of a Project)
  parentId: string; // or null
  modified: number;
  created: number;
  isPrivate: boolean;
  name: string;
}

import type { IpcMainInvokeEvent } from 'electron';
import type {
  ApiSpec,
  BaseGitCredentialsV2,
  CaCertificate,
  ClientCertificate,
  CloudProviderCredential,
  CloudProviderName,
  CookieJar,
  Environment,
  GitCredentials,
  GitCredentialsV2,
  GitRepository,
  GrpcRequest,
  GrpcRequestMeta,
  MockRoute,
  MockServer,
  OAuth2Token,
  Project,
  ProjectLintRuleset,
  ProtoDirectory,
  ProtoFile,
  Query,
  Request,
  RequestGroup,
  RequestGroupMeta,
  RequestMeta,
  Response,
  RunnerTestResult,
  Settings,
  SocketIOPayload,
  SocketIORequest,
  SocketIORequestMeta,
  Stats,
  UnitTest,
  UnitTestResult,
  UnitTestSuite,
  UserSession,
  WebSocketPayload,
  WebSocketRequest,
  WebSocketRequestMeta,
  Workspace,
  WorkspaceMeta,
} from 'insomnia-data';
import { services } from 'insomnia-data';

// Named per-pair handlers for services.invoke pairs migrated off the generic reflection-based
// gateway (see services-invoke-surface.ts, SERVICES-INVOKE-MIGRATION-PLAN.md). Each forwards to the
// exact same services.* call the generic dispatch made for that pair, with the same arguments — main.ts
// registers each of these under the literal channel name `services.<serviceName>.<methodName>`. The
// unused first parameter is typed IpcMainInvokeEvent (matching ipcMainHandle's real listener
// signature) rather than `unknown`, purely for type accuracy — none of these forwarders read it, so
// this has no security effect on its own; it just keeps the door open for a future handler to add an
// event.sender check (as templatingDb.getAuthToken already does) without a type change first.

export const caCertificateCreate = (_: IpcMainInvokeEvent, patch: Partial<CaCertificate> = {}) => services.caCertificate.create(patch);
export const caCertificateGetById = (_: IpcMainInvokeEvent, id: string) => services.caCertificate.getById(id);
export const caCertificateGetByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.caCertificate.getByParentId(parentId);
export const caCertificateRemoveWhere = (_: IpcMainInvokeEvent, parentId: string) => services.caCertificate.removeWhere(parentId);
export const caCertificateUpdate = (_: IpcMainInvokeEvent, cert: CaCertificate, patch: Partial<CaCertificate> = {}) => services.caCertificate.update(cert, patch);

export const clientCertificateCreate = (_: IpcMainInvokeEvent, patch: Partial<ClientCertificate> = {}) => services.clientCertificate.create(patch);
export const clientCertificateFindByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.clientCertificate.findByParentId(parentId);
export const clientCertificateGetById = (_: IpcMainInvokeEvent, id: string) => services.clientCertificate.getById(id);
export const clientCertificateRemove = (_: IpcMainInvokeEvent, cert: ClientCertificate) => services.clientCertificate.remove(cert);
export const clientCertificateUpdate = (_: IpcMainInvokeEvent, cert: ClientCertificate, patch: Partial<ClientCertificate> = {}) => services.clientCertificate.update(cert, patch);

export const cloudCredentialAll = (_: IpcMainInvokeEvent) => services.cloudCredential.all();
export const cloudCredentialCreate = (_: IpcMainInvokeEvent, patch: Partial<CloudProviderCredential> = {}) => services.cloudCredential.create(patch);
export const cloudCredentialGetById = (_: IpcMainInvokeEvent, id: string) => services.cloudCredential.getById(id);
export const cloudCredentialGetByName = (_: IpcMainInvokeEvent, name: string, provider: CloudProviderName) => services.cloudCredential.getByName(name, provider);
export const cloudCredentialRemove = (_: IpcMainInvokeEvent, credential: CloudProviderCredential) => services.cloudCredential.remove(credential);
export const cloudCredentialUpdate = (_: IpcMainInvokeEvent, credential: CloudProviderCredential, patch: Partial<CloudProviderCredential>) => services.cloudCredential.update(credential, patch);

export const settingsGet = (_: IpcMainInvokeEvent) => services.settings.get();
export const settingsGetOrCreate = (_: IpcMainInvokeEvent) => services.settings.getOrCreate();
export const settingsPatch = (_: IpcMainInvokeEvent, patch: Partial<Settings>) => services.settings.patch(patch);
export const settingsUpdate = (_: IpcMainInvokeEvent, settings: Settings, patch: Partial<Settings>) => services.settings.update(settings, patch);

export const gitCredentialsAll = (_: IpcMainInvokeEvent) => services.gitCredentials.all();
export const gitCredentialsCreate = (_: IpcMainInvokeEvent, patch: BaseGitCredentialsV2) => services.gitCredentials.create(patch);
export const gitCredentialsGetById = (_: IpcMainInvokeEvent, id: string) => services.gitCredentials.getById(id);
export const gitCredentialsRemove = (_: IpcMainInvokeEvent, credentials: GitCredentials) => services.gitCredentials.remove(credentials);
export const gitCredentialsRemoveAll = (_: IpcMainInvokeEvent) => services.gitCredentials.removeAll();
export const gitCredentialsUpdate = (_: IpcMainInvokeEvent, credentials: GitCredentialsV2, patch: Partial<GitCredentialsV2>) => services.gitCredentials.update(credentials, patch);

export const userSessionGet = (_: IpcMainInvokeEvent) => services.userSession.get();
export const userSessionRemove = (_: IpcMainInvokeEvent) => services.userSession.remove();
export const userSessionUpdate = (_: IpcMainInvokeEvent, patch: Partial<UserSession>) => services.userSession.update(patch);

export const environmentCreate = (_: IpcMainInvokeEvent, patch: Partial<Environment> = {}) => services.environment.create(patch);
export const environmentUpdate = (_: IpcMainInvokeEvent, environment: Environment, patch: Partial<Environment>) => services.environment.update(environment, patch);
export const environmentList = (_: IpcMainInvokeEvent, query?: Query<Environment>, sort?: Record<string, any>, limit?: number) => services.environment.list(query, sort, limit);
export const environmentListByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.environment.listByParentId(parentId);
export const environmentGetOrCreateForParentId = (_: IpcMainInvokeEvent, parentId: string) => services.environment.getOrCreateForParentId(parentId);
export const environmentGetById = (_: IpcMainInvokeEvent, id: string) => services.environment.getById(id);
export const environmentGetByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.environment.getByParentId(parentId);
export const environmentDuplicate = (_: IpcMainInvokeEvent, environment: Environment) => services.environment.duplicate(environment);
export const environmentRemove = (_: IpcMainInvokeEvent, environment: Environment) => services.environment.remove(environment);
export const environmentRemoveAllSecrets = (_: IpcMainInvokeEvent, organizationIds: string[]) => services.environment.removeAllSecrets(organizationIds);

export const apiSpecGetByParentId = (_: IpcMainInvokeEvent, workspaceId: string) => services.apiSpec.getByParentId(workspaceId);
export const apiSpecGetOrCreateForParentId = (_: IpcMainInvokeEvent, workspaceId: string, patch: Partial<ApiSpec> = {}) => services.apiSpec.getOrCreateForParentId(workspaceId, patch);
export const apiSpecUpdate = (_: IpcMainInvokeEvent, apiSpec: ApiSpec, patch: Partial<ApiSpec> = {}) => services.apiSpec.update(apiSpec, patch);
export const apiSpecUpdateOrCreateForParentId = (_: IpcMainInvokeEvent, workspaceId: string, patch: Partial<ApiSpec> = {}) => services.apiSpec.updateOrCreateForParentId(workspaceId, patch);

export const cookieJarGetById = (_: IpcMainInvokeEvent, id: string) => services.cookieJar.getById(id);
export const cookieJarGetOrCreateForParentId = (_: IpcMainInvokeEvent, parentId: string) => services.cookieJar.getOrCreateForParentId(parentId);
export const cookieJarUpdate = (_: IpcMainInvokeEvent, cookieJar: CookieJar, patch: Partial<CookieJar> = {}) => services.cookieJar.update(cookieJar, patch);

export const gitRepositoryAll = (_: IpcMainInvokeEvent) => services.gitRepository.all();
export const gitRepositoryGetAllByCredentialId = (_: IpcMainInvokeEvent, credentialsId: string) => services.gitRepository.getAllByCredentialId(credentialsId);
export const gitRepositoryGetById = (_: IpcMainInvokeEvent, id: string) => services.gitRepository.getById(id);
export const gitRepositoryRemove = (_: IpcMainInvokeEvent, repo: GitRepository) => services.gitRepository.remove(repo);
export const gitRepositoryUpdate = (_: IpcMainInvokeEvent, repo: GitRepository, patch: Partial<GitRepository>) => services.gitRepository.update(repo, patch);

export const grpcRequestCreate = (_: IpcMainInvokeEvent, patch: Partial<GrpcRequest> = {}) => services.grpcRequest.create(patch);
export const grpcRequestFindByProtoFileId = (_: IpcMainInvokeEvent, protoFileId: string) => services.grpcRequest.findByProtoFileId(protoFileId);

export const grpcRequestMetaGetByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.grpcRequestMeta.getByParentId(parentId);
export const grpcRequestMetaUpdateOrCreateByParentId = (_: IpcMainInvokeEvent, parentId: string, patch: Partial<GrpcRequestMeta>) => services.grpcRequestMeta.updateOrCreateByParentId(parentId, patch);

export const helpersAbortCommandSearch = (_: IpcMainInvokeEvent, requestId: string) => services.helpers.abortCommandSearch(requestId);
export const helpersCommandSearch = (_: IpcMainInvokeEvent, params: Parameters<typeof services.helpers.commandSearch>[0]) => services.helpers.commandSearch(params);
export const helpersDuplicateRequest = (_: IpcMainInvokeEvent, request: any, patch: any = {}) => services.helpers.duplicateRequest(request, patch);
export const helpersFindRequestByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.helpers.findRequestByParentId(parentId);
export const helpersGetRequestById = (_: IpcMainInvokeEvent, requestId: string) => services.helpers.getRequestById(requestId);
export const helpersGetResponseBodyBuffer = (_: IpcMainInvokeEvent, response?: Parameters<typeof services.helpers.getResponseBodyBuffer>[0], readFailureValue?: string) => services.helpers.getResponseBodyBuffer(response, readFailureValue);
export const helpersGetResponseTimeline = (_: IpcMainInvokeEvent, response: Parameters<typeof services.helpers.getResponseTimeline>[0], showBody?: boolean) => services.helpers.getResponseTimeline(response, showBody);
export const helpersQueryAllWorkspaceUrls = (_: IpcMainInvokeEvent, workspaceId: string, reqType: Parameters<typeof services.helpers.queryAllWorkspaceUrls>[1], reqId?: string) => services.helpers.queryAllWorkspaceUrls(workspaceId, reqType, reqId);
export const helpersReadCurlResponse = (_: IpcMainInvokeEvent, options: Parameters<typeof services.helpers.readCurlResponse>[0]) => services.helpers.readCurlResponse(options);
export const helpersRemoveRequest = (_: IpcMainInvokeEvent, request: any) => services.helpers.removeRequest(request);
export const helpersRemoveResponse = (_: IpcMainInvokeEvent, response: Parameters<typeof services.helpers.removeResponse>[0]) => services.helpers.removeResponse(response);
export const helpersRemoveResponsesForRequest = (_: IpcMainInvokeEvent, requestId: string, environmentId?: string | null) => services.helpers.removeResponsesForRequest(requestId, environmentId);
export const helpersUpdateRequest = (_: IpcMainInvokeEvent, request: any, patch: any = {}) => services.helpers.updateRequest(request, patch);

export const mcpPayloadGetByParentIdAndUrl = (_: IpcMainInvokeEvent, parentId: string, url: string) => services.mcpPayload.getByParentIdAndUrl(parentId, url);
export const mcpPayloadUpdateOrCreateByParentIdAndUrl = (_: IpcMainInvokeEvent, parentId: string, patch: Parameters<typeof services.mcpPayload.updateOrCreateByParentIdAndUrl>[1]) => services.mcpPayload.updateOrCreateByParentIdAndUrl(parentId, patch);

export const mcpRequestCreate = (_: IpcMainInvokeEvent, patch: Parameters<typeof services.mcpRequest.create>[0]) => services.mcpRequest.create(patch);
export const mcpRequestGetById = (_: IpcMainInvokeEvent, id: string) => services.mcpRequest.getById(id);
export const mcpRequestGetByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.mcpRequest.getByParentId(parentId);

export const mcpResponseGetById = (_: IpcMainInvokeEvent, id: string) => services.mcpResponse.getById(id);
export const mcpResponseGetLatestForRequestId = (_: IpcMainInvokeEvent, requestId: string, environmentId: string | null) => services.mcpResponse.getLatestForRequestId(requestId, environmentId);

export const mockRouteCreate = (_: IpcMainInvokeEvent, patch: Partial<MockRoute> = {}) => services.mockRoute.create(patch);
export const mockRouteFindByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.mockRoute.findByParentId(parentId);
export const mockRouteGetById = (_: IpcMainInvokeEvent, id: string) => services.mockRoute.getById(id);
export const mockRouteRemove = (_: IpcMainInvokeEvent, mockRoute: MockRoute) => services.mockRoute.remove(mockRoute);
export const mockRouteUpdate = (_: IpcMainInvokeEvent, mockRoute: MockRoute, patch: Partial<MockRoute> = {}) => services.mockRoute.update(mockRoute, patch);

export const mockServerFindByProjectId = (_: IpcMainInvokeEvent, projectId: string) => services.mockServer.findByProjectId(projectId);
export const mockServerGetById = (_: IpcMainInvokeEvent, id: string) => services.mockServer.getById(id);
export const mockServerGetByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.mockServer.getByParentId(parentId);
export const mockServerGetOrCreateForParentId = (_: IpcMainInvokeEvent, workspaceId: string, patch: Partial<MockServer> = {}) => services.mockServer.getOrCreateForParentId(workspaceId, patch);
export const mockServerUpdate = (_: IpcMainInvokeEvent, mockServer: MockServer, patch: Partial<MockServer> = {}) => services.mockServer.update(mockServer, patch);

export const organizationList = (_: IpcMainInvokeEvent) => services.organization.list();

export const pluginDataAll = (_: IpcMainInvokeEvent, plugin: string) => services.pluginData.all(plugin);
export const pluginDataGetByKey = (_: IpcMainInvokeEvent, plugin: string, key: string) => services.pluginData.getByKey(plugin, key);
export const pluginDataRemoveAll = (_: IpcMainInvokeEvent, plugin: string) => services.pluginData.removeAll(plugin);
export const pluginDataRemoveByKey = (_: IpcMainInvokeEvent, plugin: string, key: string) => services.pluginData.removeByKey(plugin, key);
export const pluginDataUpsertByKey = (_: IpcMainInvokeEvent, plugin: string, key: string, value: string) => services.pluginData.upsertByKey(plugin, key, value);

export const projectCount = (_: IpcMainInvokeEvent, query?: Query<Project>) => services.project.count(query);
export const projectCreate = (_: IpcMainInvokeEvent, patch: Partial<Project> = {}) => services.project.create(patch);
export const projectGet = (_: IpcMainInvokeEvent, query?: Query<Project>, sort?: Record<string, any>) => services.project.get(query, sort);
export const projectGetById = (_: IpcMainInvokeEvent, id: string) => services.project.getById(id);
export const projectList = (_: IpcMainInvokeEvent, query?: Query<Project>, sort?: Record<string, any>, limit?: number) => services.project.list(query, sort, limit);
export const projectListByGitRepositoryIds = (_: IpcMainInvokeEvent, gitRepositoryIds: string | string[]) => services.project.listByGitRepositoryIds(gitRepositoryIds);
export const projectListByOrganizationIds = (_: IpcMainInvokeEvent, organizationIds: string | string[]) => services.project.listByOrganizationIds(organizationIds);
export const projectRemove = (_: IpcMainInvokeEvent, idOrProject: string | Project) => services.project.remove(idOrProject);
export const projectUpdate = (_: IpcMainInvokeEvent, idOrProject: string | Project, patch: Partial<Project>) => services.project.update(idOrProject, patch);

export const projectLintRulesetGetByParentId = (_: IpcMainInvokeEvent, projectId: string) => services.projectLintRuleset.getByParentId(projectId);
export const projectLintRulesetRemove = (_: IpcMainInvokeEvent, projectId: string) => services.projectLintRuleset.remove(projectId);
export const projectLintRulesetUpsert = (_: IpcMainInvokeEvent, projectId: string, patch: Partial<ProjectLintRuleset> = {}) => services.projectLintRuleset.upsert(projectId, patch);

export const protoDirectoryAll = (_: IpcMainInvokeEvent) => services.protoDirectory.all();
export const protoDirectoryCreate = (_: IpcMainInvokeEvent, patch: Partial<ProtoDirectory> = {}) => services.protoDirectory.create(patch);
export const protoDirectoryFindByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.protoDirectory.findByParentId(parentId);
export const protoDirectoryRemove = (_: IpcMainInvokeEvent, obj: ProtoDirectory) => services.protoDirectory.remove(obj);

export const protoFileAll = (_: IpcMainInvokeEvent) => services.protoFile.all();
export const protoFileCreate = (_: IpcMainInvokeEvent, patch: Partial<ProtoFile> = {}) => services.protoFile.create(patch);
export const protoFileFindByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.protoFile.findByParentId(parentId);
export const protoFileRemove = (_: IpcMainInvokeEvent, protoFile: ProtoFile) => services.protoFile.remove(protoFile);
export const protoFileUpdate = (_: IpcMainInvokeEvent, protoFile: ProtoFile, patch: Partial<ProtoFile> = {}) => services.protoFile.update(protoFile, patch);

export const requestCreate = (_: IpcMainInvokeEvent, patch: Partial<Request> = {}) => services.request.create(patch);
export const requestFindByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.request.findByParentId(parentId);
export const requestGetById = (_: IpcMainInvokeEvent, id: string) => services.request.getById(id);
export const requestGetByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.request.getByParentId(parentId);
export const requestUpdate = (_: IpcMainInvokeEvent, request: Request, patch: Partial<Request>) => services.request.update(request, patch);

export const requestGroupCreate = (_: IpcMainInvokeEvent, patch: Partial<RequestGroup> = {}) => services.requestGroup.create(patch);
export const requestGroupDuplicate = (_: IpcMainInvokeEvent, requestGroup: RequestGroup, patch: Partial<RequestGroup> = {}) => services.requestGroup.duplicate(requestGroup, patch);
export const requestGroupFindByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.requestGroup.findByParentId(parentId);
export const requestGroupGetById = (_: IpcMainInvokeEvent, id: string) => services.requestGroup.getById(id);
export const requestGroupRemove = (_: IpcMainInvokeEvent, requestGroup: RequestGroup) => services.requestGroup.remove(requestGroup);
export const requestGroupUpdate = (_: IpcMainInvokeEvent, requestGroup: RequestGroup, patch: Partial<RequestGroup> = {}) => services.requestGroup.update(requestGroup, patch);

export const requestGroupMetaCreate = (_: IpcMainInvokeEvent, patch: Partial<RequestGroupMeta> = {}) => services.requestGroupMeta.create(patch);
export const requestGroupMetaGetByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.requestGroupMeta.getByParentId(parentId);
export const requestGroupMetaUpdate = (_: IpcMainInvokeEvent, requestGroupMeta: RequestGroupMeta, patch: Partial<RequestGroupMeta>) => services.requestGroupMeta.update(requestGroupMeta, patch);
export const requestGroupMetaUpdateOrCreateForParentId = (_: IpcMainInvokeEvent, parentId: string, patch: Partial<RequestGroupMeta> = {}) => services.requestGroupMeta.updateOrCreateForParentId(parentId, patch);

export const requestMetaGetByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.requestMeta.getByParentId(parentId);
export const requestMetaGetOrCreateByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.requestMeta.getOrCreateByParentId(parentId);
export const requestMetaUpdate = (_: IpcMainInvokeEvent, requestMeta: RequestMeta, patch: Partial<RequestMeta>) => services.requestMeta.update(requestMeta, patch);
export const requestMetaUpdateOrCreateByParentId = (_: IpcMainInvokeEvent, parentId: string, patch: Partial<RequestMeta>) => services.requestMeta.updateOrCreateByParentId(parentId, patch);

export const requestVersionFindByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.requestVersion.findByParentId(parentId);
export const requestVersionRestore = (_: IpcMainInvokeEvent, requestVersionId: string) => services.requestVersion.restore(requestVersionId);

export const responseCreate = (_: IpcMainInvokeEvent, patch: Partial<Response> = {}, maxResponses?: number) => services.response.create(patch, maxResponses);
export const responseGetByBodyPath = (_: IpcMainInvokeEvent, bodyPath: string) => services.response.getByBodyPath(bodyPath);
export const responseGetById = (_: IpcMainInvokeEvent, id: string) => services.response.getById(id);
export const responseGetLatestForRequestId = (_: IpcMainInvokeEvent, requestId: string, environmentId: string | null) => services.response.getLatestForRequestId(requestId, environmentId);
export const responseFindByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.response.findByParentId(parentId);

export const runnerTestResultCreate = (_: IpcMainInvokeEvent, patch: Partial<RunnerTestResult> = {}) => services.runnerTestResult.create(patch);
export const runnerTestResultFindByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.runnerTestResult.findByParentId(parentId);
export const runnerTestResultGetById = (_: IpcMainInvokeEvent, id: string) => services.runnerTestResult.getById(id);
export const runnerTestResultRemove = (_: IpcMainInvokeEvent, item: RunnerTestResult) => services.runnerTestResult.remove(item);

export const socketIOPayloadGetOrCreateByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.socketIOPayload.getOrCreateByParentId(parentId);
export const socketIOPayloadUpdateOrCreateByParentId = (_: IpcMainInvokeEvent, parentId: string, patch: Partial<SocketIOPayload>) => services.socketIOPayload.updateOrCreateByParentId(parentId, patch);

export const socketIORequestCreate = (_: IpcMainInvokeEvent, patch: Partial<SocketIORequest> = {}) => services.socketIORequest.create(patch);

export const socketIORequestMetaUpdateOrCreateByParentId = (_: IpcMainInvokeEvent, parentId: string, patch: Partial<SocketIORequestMeta>) => services.socketIORequestMeta.updateOrCreateByParentId(parentId, patch);

export const socketIOResponseGetById = (_: IpcMainInvokeEvent, id: string) => services.socketIOResponse.getById(id);
export const socketIOResponseFindByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.socketIOResponse.findByParentId(parentId);
export const socketIOResponseGetLatestForRequestId = (_: IpcMainInvokeEvent, requestId: string, environmentId: string | null) => services.socketIOResponse.getLatestForRequestId(requestId, environmentId);

export const statsGet = (_: IpcMainInvokeEvent) => services.stats.get();
export const statsIncrementCreatedRequests = (_: IpcMainInvokeEvent) => services.stats.incrementCreatedRequests();
export const statsIncrementCreatedRequestsForDescendents = (_: IpcMainInvokeEvent, doc: Workspace | RequestGroup) => services.stats.incrementCreatedRequestsForDescendents(doc);
export const statsIncrementDeletedRequests = (_: IpcMainInvokeEvent) => services.stats.incrementDeletedRequests();
export const statsIncrementDeletedRequestsForDescendents = (_: IpcMainInvokeEvent, doc: Workspace | RequestGroup | Project) => services.stats.incrementDeletedRequestsForDescendents(doc);
export const statsIncrementExecutedRequests = (_: IpcMainInvokeEvent) => services.stats.incrementExecutedRequests();
export const statsUpdate = (_: IpcMainInvokeEvent, patch: Partial<Stats>) => services.stats.update(patch);

export const unitTestCreate = (_: IpcMainInvokeEvent, patch: Partial<UnitTest> = {}) => services.unitTest.create(patch);
export const unitTestRemove = (_: IpcMainInvokeEvent, unitTest: UnitTest) => services.unitTest.remove(unitTest);
export const unitTestUpdate = (_: IpcMainInvokeEvent, unitTest: UnitTest, patch: Partial<UnitTest> = {}) => services.unitTest.update(unitTest, patch);

export const unitTestResultCreate = (_: IpcMainInvokeEvent, patch: Partial<UnitTestResult> = {}) => services.unitTestResult.create(patch);

export const unitTestSuiteCreate = (_: IpcMainInvokeEvent, patch: Partial<UnitTestSuite> = {}) => services.unitTestSuite.create(patch);
export const unitTestSuiteFindByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.unitTestSuite.findByParentId(parentId);
export const unitTestSuiteGetById = (_: IpcMainInvokeEvent, id: string) => services.unitTestSuite.getById(id);
export const unitTestSuiteRemove = (_: IpcMainInvokeEvent, unitTestSuite: UnitTestSuite) => services.unitTestSuite.remove(unitTestSuite);
export const unitTestSuiteUpdate = (_: IpcMainInvokeEvent, unitTestSuite: UnitTestSuite, patch: Partial<UnitTestSuite> = {}) => services.unitTestSuite.update(unitTestSuite, patch);

export const webSocketPayloadCreate = (_: IpcMainInvokeEvent, patch: Partial<WebSocketPayload> = {}) => services.webSocketPayload.create(patch);
export const webSocketPayloadGetByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.webSocketPayload.getByParentId(parentId);
export const webSocketPayloadUpdate = (_: IpcMainInvokeEvent, obj: WebSocketPayload, patch: Partial<WebSocketPayload> = {}) => services.webSocketPayload.update(obj, patch);

export const webSocketRequestCreate = (_: IpcMainInvokeEvent, patch: Partial<WebSocketRequest> = {}) => services.webSocketRequest.create(patch);

export const webSocketRequestMetaUpdateOrCreateByParentId = (_: IpcMainInvokeEvent, parentId: string, patch: Partial<WebSocketRequestMeta>) => services.webSocketRequestMeta.updateOrCreateByParentId(parentId, patch);

export const webSocketResponseGetById = (_: IpcMainInvokeEvent, id: string) => services.webSocketResponse.getById(id);
export const webSocketResponseFindByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.webSocketResponse.findByParentId(parentId);
export const webSocketResponseGetLatestForRequestId = (_: IpcMainInvokeEvent, requestId: string, environmentId: string | null) => services.webSocketResponse.getLatestForRequestId(requestId, environmentId);

export const workspaceCount = (_: IpcMainInvokeEvent, query?: Query<Workspace>) => services.workspace.count(query);
export const workspaceCreate = (_: IpcMainInvokeEvent, patch: Partial<Workspace> = {}) => services.workspace.create(patch);
export const workspaceGetById = (_: IpcMainInvokeEvent, id?: string) => services.workspace.getById(id);
export const workspaceList = (_: IpcMainInvokeEvent, query?: Query<Workspace>, sort?: Record<string, any>, limit?: number) => services.workspace.list(query, sort, limit);
export const workspaceListByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.workspace.listByParentId(parentId);
export const workspaceRemove = (_: IpcMainInvokeEvent, idOrWorkspace: string | Workspace) => services.workspace.remove(idOrWorkspace);
export const workspaceUpdate = (_: IpcMainInvokeEvent, idOrWorkspace: string | Workspace, patch: Partial<Workspace>) => services.workspace.update(idOrWorkspace, patch);

export const workspaceMetaCreate = (_: IpcMainInvokeEvent, patch: Partial<WorkspaceMeta> = {}) => services.workspaceMeta.create(patch);
export const workspaceMetaGetByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.workspaceMeta.getByParentId(parentId);
export const workspaceMetaGetOrCreateByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.workspaceMeta.getOrCreateByParentId(parentId);
export const workspaceMetaList = (_: IpcMainInvokeEvent, query?: Query<WorkspaceMeta>, sort?: Record<string, any>, limit?: number) => services.workspaceMeta.list(query, sort, limit);
export const workspaceMetaUpdate = (_: IpcMainInvokeEvent, workspaceMeta: WorkspaceMeta, patch: Partial<WorkspaceMeta> = {}) => services.workspaceMeta.update(workspaceMeta, patch);
export const workspaceMetaUpdateByParentId = (_: IpcMainInvokeEvent, parentId: string, patch: Partial<WorkspaceMeta> = {}) => services.workspaceMeta.updateByParentId(parentId, patch);

// Not in the plan's original §4/§5 enumeration (added to the codebase after that snapshot, or missed
// by the original hand-run grep) — the detector is the live source of truth, so these are migrated too.
export const oAuth2TokenCreate = (_: IpcMainInvokeEvent, patch: Partial<OAuth2Token> = {}) => services.oAuth2Token.create(patch);
export const oAuth2TokenGetByParentId = (_: IpcMainInvokeEvent, parentId: string) => services.oAuth2Token.getByParentId(parentId);
export const oAuth2TokenRemove = (_: IpcMainInvokeEvent, token: OAuth2Token) => services.oAuth2Token.remove(token);
export const oAuth2TokenUpdate = (_: IpcMainInvokeEvent, token: OAuth2Token, patch: Partial<OAuth2Token>) => services.oAuth2Token.update(token, patch);

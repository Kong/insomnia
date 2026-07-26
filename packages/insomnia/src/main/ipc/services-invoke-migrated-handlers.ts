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
  Query,
  Settings,
  UserSession,
} from 'insomnia-data';
import { services } from 'insomnia-data';

// Named per-pair handlers for services.invoke pairs migrated off the generic reflection-based
// gateway (see services-invoke-surface.ts, SERVICES-INVOKE-MIGRATION-PLAN.md). Each forwards to the
// exact same services.* call the generic dispatch made for that pair, with the same arguments — main.ts
// registers each of these under the literal channel name `services.<serviceName>.<methodName>`.

export const caCertificateCreate = (_: unknown, patch: Partial<CaCertificate> = {}) => services.caCertificate.create(patch);
export const caCertificateGetById = (_: unknown, id: string) => services.caCertificate.getById(id);
export const caCertificateGetByParentId = (_: unknown, parentId: string) => services.caCertificate.getByParentId(parentId);
export const caCertificateRemoveWhere = (_: unknown, parentId: string) => services.caCertificate.removeWhere(parentId);
export const caCertificateUpdate = (_: unknown, cert: CaCertificate, patch: Partial<CaCertificate> = {}) => services.caCertificate.update(cert, patch);

export const clientCertificateCreate = (_: unknown, patch: Partial<ClientCertificate> = {}) => services.clientCertificate.create(patch);
export const clientCertificateFindByParentId = (_: unknown, parentId: string) => services.clientCertificate.findByParentId(parentId);
export const clientCertificateGetById = (_: unknown, id: string) => services.clientCertificate.getById(id);
export const clientCertificateRemove = (_: unknown, cert: ClientCertificate) => services.clientCertificate.remove(cert);
export const clientCertificateUpdate = (_: unknown, cert: ClientCertificate, patch: Partial<ClientCertificate> = {}) => services.clientCertificate.update(cert, patch);

export const cloudCredentialAll = (_: unknown) => services.cloudCredential.all();
export const cloudCredentialCreate = (_: unknown, patch: Partial<CloudProviderCredential> = {}) => services.cloudCredential.create(patch);
export const cloudCredentialGetById = (_: unknown, id: string) => services.cloudCredential.getById(id);
export const cloudCredentialGetByName = (_: unknown, name: string, provider: CloudProviderName) => services.cloudCredential.getByName(name, provider);
export const cloudCredentialRemove = (_: unknown, credential: CloudProviderCredential) => services.cloudCredential.remove(credential);
export const cloudCredentialUpdate = (_: unknown, credential: CloudProviderCredential, patch: Partial<CloudProviderCredential>) => services.cloudCredential.update(credential, patch);

export const settingsGet = (_: unknown) => services.settings.get();
export const settingsGetOrCreate = (_: unknown) => services.settings.getOrCreate();
export const settingsPatch = (_: unknown, patch: Partial<Settings>) => services.settings.patch(patch);
export const settingsUpdate = (_: unknown, settings: Settings, patch: Partial<Settings>) => services.settings.update(settings, patch);

export const gitCredentialsAll = (_: unknown) => services.gitCredentials.all();
export const gitCredentialsCreate = (_: unknown, patch: BaseGitCredentialsV2) => services.gitCredentials.create(patch);
export const gitCredentialsGetById = (_: unknown, id: string) => services.gitCredentials.getById(id);
export const gitCredentialsRemove = (_: unknown, credentials: GitCredentials) => services.gitCredentials.remove(credentials);
export const gitCredentialsRemoveAll = (_: unknown) => services.gitCredentials.removeAll();
export const gitCredentialsUpdate = (_: unknown, credentials: GitCredentialsV2, patch: Partial<GitCredentialsV2>) => services.gitCredentials.update(credentials, patch);

export const userSessionGet = (_: unknown) => services.userSession.get();
export const userSessionRemove = (_: unknown) => services.userSession.remove();
export const userSessionUpdate = (_: unknown, patch: Partial<UserSession>) => services.userSession.update(patch);

export const environmentCreate = (_: unknown, patch: Partial<Environment> = {}) => services.environment.create(patch);
export const environmentUpdate = (_: unknown, environment: Environment, patch: Partial<Environment>) => services.environment.update(environment, patch);
export const environmentList = (_: unknown, query?: Query<Environment>, sort?: Record<string, any>, limit?: number) => services.environment.list(query, sort, limit);
export const environmentListByParentId = (_: unknown, parentId: string) => services.environment.listByParentId(parentId);
export const environmentGetOrCreateForParentId = (_: unknown, parentId: string) => services.environment.getOrCreateForParentId(parentId);
export const environmentGetById = (_: unknown, id: string) => services.environment.getById(id);
export const environmentGetByParentId = (_: unknown, parentId: string) => services.environment.getByParentId(parentId);
export const environmentDuplicate = (_: unknown, environment: Environment) => services.environment.duplicate(environment);
export const environmentRemove = (_: unknown, environment: Environment) => services.environment.remove(environment);
export const environmentRemoveAllSecrets = (_: unknown, organizationIds: string[]) => services.environment.removeAllSecrets(organizationIds);

export const apiSpecGetByParentId = (_: unknown, workspaceId: string) => services.apiSpec.getByParentId(workspaceId);
export const apiSpecGetOrCreateForParentId = (_: unknown, workspaceId: string, patch: Partial<ApiSpec> = {}) => services.apiSpec.getOrCreateForParentId(workspaceId, patch);
export const apiSpecUpdate = (_: unknown, apiSpec: ApiSpec, patch: Partial<ApiSpec> = {}) => services.apiSpec.update(apiSpec, patch);
export const apiSpecUpdateOrCreateForParentId = (_: unknown, workspaceId: string, patch: Partial<ApiSpec> = {}) => services.apiSpec.updateOrCreateForParentId(workspaceId, patch);

export const cookieJarGetById = (_: unknown, id: string) => services.cookieJar.getById(id);
export const cookieJarGetOrCreateForParentId = (_: unknown, parentId: string) => services.cookieJar.getOrCreateForParentId(parentId);
export const cookieJarUpdate = (_: unknown, cookieJar: CookieJar, patch: Partial<CookieJar> = {}) => services.cookieJar.update(cookieJar, patch);

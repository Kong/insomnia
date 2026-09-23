import type { Settings as AppSettings } from "../../insomnia-data/common-src/settings";
import type {
  AWSFileCredential,
  GCPCredential,
  VaultAppRoleCredential,
} from "../../insomnia-data/src/models/cloud-credential";

// Each provider's real `credentials` field (`CloudProviderCredential` in
// insomnia-data) is itself a union of every auth mode that provider
// supports (e.g. AWS: temporary/file/SSO) — narrowed here to just the one
// `PreferencesPage` actually has a create method for (AWS: "Credential
// File"; HashiCorp: on-prem AppRole), so a caller can't hand in a shape
// (e.g. AWS temporary credentials) no create method reads. `azure` is
// left out entirely: its credential only ever comes from a real OAuth
// redirect, so there's no create method for it either.
type SupportedCloudCredentials = {
  aws: AWSFileCredential;
  gcp: GCPCredential;
  hashicorp: VaultAppRoleCredential;
};

/**
 * A cloud (vault) service credential to create via Preferences ->
 * Credentials — reuses the app's own real per-provider `credentials`
 * shapes from `insomnia-data` (see `SupportedCloudCredentials` above)
 * rather than redefining them.
 */
export type CloudCredential = {
  [P in keyof SupportedCloudCredentials]: {
    provider: P;
    name: string;
    credentials: SupportedCloudCredentials[P];
  };
}[keyof SupportedCloudCredentials];

/**
 * Config for the AI Settings tab's "url" backend, applied entirely through
 * its real UI form (fill URL/API Token -> "Load Models" -> select a model
 * -> Advanced Options -> "Activate"). Not an `AppSettings` field itself —
 * an LLM backend's config lives behind the app's own per-backend storage,
 * not a scalar app setting — so it's a synthetic addition to `SettingsInit`
 * rather than a `Pick<AppSettings, ...>` member.
 */
export interface AiUrlBackendSettings {
  url: string;
  model: string;
  apiKey?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  /**
   * Read-back only — ignored on input (configuring always activates;
   * deactivating is only reachable via `aiUrlBackend: null`). Set by
   * `PreferencesFlow.set()`'s return value to report whether this config
   * ended up as the active backend.
   */
  isActive?: boolean;
}

export type SettingsInit = Partial<
  Pick<
    AppSettings,
    | "validateSSL"
    | "dataFolders"
    | "templateTagSandboxEnabled"
    | "filterResponsesByEnv"
    | "timeout"
    | "proxyEnabled"
    | "httpProxy"
    | "httpsProxy"
    | "noProxy"
    | "sidebarFocusForCollections"
  >
> & {
  /**
   * Configure-and-activate the "url" AI backend when given an object;
   * deactivate the current backend (keeping its stored config) when
   * explicitly `null`; leave AI backend state untouched when `undefined`.
   */
  aiUrlBackend?: AiUrlBackendSettings | null;
  /**
   * Cloud (vault) service credentials to add via Preferences ->
   * Credentials, in order. Not an `AppSettings` field itself — a cloud
   * credential is its own document, not a scalar app setting.
   */
  cloudCredentials?: CloudCredential[];
  /**
   * Preferences -> General's "Show legacy unit tests" checkbox. Named for
   * its current UI label rather than `AppSettings.enableLegacyUnitTests`
   * (the underlying app setting key, unchanged since the label rename).
   */
  showLegacyUnitTests?: boolean;
};

export class Settings implements SettingsInit {
  validateSSL?: boolean;
  dataFolders?: string[];
  templateTagSandboxEnabled?: boolean;
  filterResponsesByEnv?: boolean;
  timeout?: number;
  proxyEnabled?: boolean;
  httpProxy?: string;
  httpsProxy?: string;
  noProxy?: string;
  sidebarFocusForCollections?: boolean;
  showLegacyUnitTests?: boolean;
  aiUrlBackend?: AiUrlBackendSettings | null;
  cloudCredentials?: CloudCredential[];

  constructor(init: SettingsInit = {}) {
    this.validateSSL = init.validateSSL;
    this.dataFolders = init.dataFolders;
    this.templateTagSandboxEnabled = init.templateTagSandboxEnabled;
    this.filterResponsesByEnv = init.filterResponsesByEnv;
    this.timeout = init.timeout;
    this.proxyEnabled = init.proxyEnabled;
    this.httpProxy = init.httpProxy;
    this.httpsProxy = init.httpsProxy;
    this.noProxy = init.noProxy;
    this.sidebarFocusForCollections = init.sidebarFocusForCollections;
    this.showLegacyUnitTests = init.showLegacyUnitTests;
    this.aiUrlBackend = init.aiUrlBackend;
    this.cloudCredentials = init.cloudCredentials;
  }
}

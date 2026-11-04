export interface StorageRules {
  enableLocalVault: boolean;
  enableGitSync: boolean;
  isOverridden: boolean;
}

export const DEFAULT_STORAGE_RULES: StorageRules = {
  enableLocalVault: true,
  enableGitSync: true,
  isOverridden: false,
};

export async function fetchAndCacheOrganizationStorageRule(_organizationId?: string, _forceFetch = false) {
  return DEFAULT_STORAGE_RULES;
}

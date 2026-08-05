/**
 * Pure git URL helpers.
 *
 * Kept free of any Electron/provider-registry imports so this module is safe to
 * import from the renderer (e.g. the create-project form) without pulling the
 * main-process-only provider graph into the renderer bundle.
 */

export const addDotGit = (url: string): string => (url.endsWith('.git') ? url : `${url}.git`);

/**
 * Azure DevOps repositories are addressed via a `/_git/<repo>` path segment and
 * must NOT have a `.git` suffix appended, unlike GitHub/GitLab/Bitbucket.
 * Detects the modern (dev.azure.com) and legacy (*.visualstudio.com) hosts as
 * well as the `/_git/` path marker for self-hosted Azure DevOps Server.
 */
export const isAzureDevOpsUrl = (url: string): boolean => {
  try {
    const { hostname, pathname } = new URL(url);
    return hostname === 'dev.azure.com' || hostname.endsWith('.visualstudio.com') || pathname.includes('/_git/');
  } catch {
    return false;
  }
};

/**
 * Normalize a remote repo URL entered by the user: trim trailing slashes and
 * append a `.git` suffix when the provider expects one (Azure DevOps does not).
 */
export const ensureGitRepoUrlSuffix = (url: string): string => {
  const trimmed = url.trim().replace(/\/+$/, '');
  if (!trimmed || isAzureDevOpsUrl(trimmed)) {
    return trimmed;
  }
  return addDotGit(trimmed);
};

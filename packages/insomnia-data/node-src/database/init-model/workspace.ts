import type { Workspace } from 'insomnia-data';
import { models } from 'insomnia-data';
import type { Merge } from 'type-fest';

import * as clientCertificateService from '../../services/client-certificate';

const { WorkspaceScopeKeys } = models.workspace;

export function migrate(doc: Workspace) {
  try {
    doc = _migrateExtractClientCertificates(doc);
    doc = _migrateEnsureName(doc);
    doc = _migrateScope(doc);
    return doc;
  } catch (e) {
    console.log('[db] Error during workspace migration', e);
    throw e;
  }
}

function _migrateExtractClientCertificates(workspace: Workspace) {
  const certificates = workspace.certificates || null;

  if (!Array.isArray(certificates)) {
    // Already migrated
    return workspace;
  }

  for (const cert of certificates) {
    clientCertificateService.create({
      parentId: workspace._id,
      host: cert.host || '',
      passphrase: cert.passphrase || null,
      cert: cert.cert || null,
      key: cert.key || null,
      pfx: cert.pfx || null,
      isPrivate: false,
    });
  }

  delete workspace.certificates;
  // This will remove the now-missing `certificates` property
  // NOTE: Using db.update so we don't change things like modified time
  return workspace;
}

/**
 * Ensure workspace has a valid String name. Due to real-world bug reports, we know
 * this happens (and it causes problems) so this migration will ensure that it is
 * corrected.
 */
function _migrateEnsureName(workspace: Workspace) {
  if (typeof workspace.name !== 'string') {
    workspace.name = 'My Workspace';
  }

  return workspace;
}

// Translate the old value
type OldScopeTypes = 'spec' | 'debug' | 'designer' | null;
type MigrationWorkspace = Merge<Workspace, { scope: OldScopeTypes | Workspace['scope'] }>;

/**
 * Ensure workspace scope is set to a valid entry
 */
function _migrateScope(workspace: MigrationWorkspace) {
  if (
    workspace.scope === WorkspaceScopeKeys.design ||
    workspace.scope === WorkspaceScopeKeys.collection ||
    workspace.scope === WorkspaceScopeKeys.mockServer ||
    workspace.scope === WorkspaceScopeKeys.environment ||
    workspace.scope === WorkspaceScopeKeys.mcp
  ) {
    return workspace as Workspace;
  }
  // designer and spec => design, unset => collection
  workspace.scope =
    workspace.scope === 'designer' || workspace.scope === 'spec'
      ? WorkspaceScopeKeys.design
      : WorkspaceScopeKeys.collection;
  return workspace as Workspace;
}

import { exportWorkspacesHAR, exportWorkspacesData } from '../../common/export';
import { importRaw, importUri } from '../../common/import';
import type { Workspace, WorkspaceScope } from '../../models/workspace';
import type { ImportRawConfig } from '../../common/import';

interface PluginImportOptions {
  workspaceId?: string;
  scope?: WorkspaceScope;
}

export function init() {
  return {
    data: {
      import: {
        async uri(uri: string, options: PluginImportOptions = {}) {
          await importUri(uri, buildImportRawConfig(options));
        },
        async raw(text: string, options: PluginImportOptions = {}) {
          await importRaw(text, buildImportRawConfig(options));
        },
      },
      export: {
        async insomnia(
          options: {
            includePrivate?: boolean;
            format?: 'json' | 'yaml';
            workspace?: Workspace;
          } = {},
        ) {
          options = options || {};
          return exportWorkspacesData(
            options.workspace || null,
            !!options.includePrivate,
            options.format || 'json',
          );
        },

        async har(
          options: {
            includePrivate?: boolean;
            workspace?: Workspace;
          } = {},
        ) {
          return exportWorkspacesHAR(options.workspace || null, !!options.includePrivate);
        },
      },
    },
  };
}

function buildImportRawConfig(options: PluginImportOptions): ImportRawConfig {
  const getWorkspaceId = () => Promise.resolve(options.workspaceId || null);

  const getWorkspaceScope = options.scope && (() => (
    Promise.resolve<WorkspaceScope>(options.scope as WorkspaceScope))
  );

  return {
    getWorkspaceId,
    getWorkspaceScope,
  };
}

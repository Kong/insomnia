// @flow
import {
  exportWorkspacesHAR,
  exportWorkspacesData,
  importRaw,
  importUri,
} from '../../common/import';
import type { Workspace, WorkspaceScope } from '../../models/workspace';
import type { ImportRawConfig } from '../../common/import';

type PluginImportOptions = { workspaceId?: string, scope?: WorkspaceScope };

export function init(): { data: { import: Object, export: Object } } {
  return {
    data: {
      import: {
        async uri(uri: string, options: PluginImportOptions = {}): Promise<void> {
          await importUri(uri, buildImportRawConfig(options));
        },
        async raw(text: string, options: PluginImportOptions = {}): Promise<void> {
          await importRaw(text, buildImportRawConfig(options));
        },
      },
      export: {
        async insomnia(
          options: {
            includePrivate?: boolean,
            format?: 'json' | 'yaml',
            workspace?: Workspace,
          } = {},
        ): Promise<string> {
          options = options || {};
          return exportWorkspacesData(
            options.workspace || null,
            !!options.includePrivate,
            options.format || 'json',
          );
        },
        async har(
          options: { includePrivate?: boolean, workspace?: Workspace } = {},
        ): Promise<string> {
          return exportWorkspacesHAR(options.workspace || null, !!options.includePrivate);
        },
      },
    },
  };
}

function buildImportRawConfig(options: PluginImportOptions): ImportRawConfig {
  const getWorkspaceId = () => Promise.resolve(options.workspaceId || null);
  const getWorkspaceScope = options.scope && (() => Promise.resolve(options.scope));
  return { getWorkspaceId, getWorkspaceScope };
}

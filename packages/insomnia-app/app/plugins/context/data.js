// @flow
import {
  exportWorkspacesHAR,
  exportWorkspacesData,
  importRaw,
  importUri,
} from '../../common/import';
import type { Workspace, WorkspaceScope } from '../../models/workspace';
import type { ImportOptions } from '../../common/import';

type PluginImportOptions = { workspaceId?: string, scope?: WorkspaceScope };

export function init(): { data: { import: Object, export: Object } } {
  return {
    data: {
      import: {
        async uri(uri: string, options: PluginImportOptions = {}): Promise<void> {
          await importUri(uri, buildImportOptions(options));
        },
        async raw(text: string, options: PluginImportOptions = {}): Promise<void> {
          await importRaw(text, buildImportOptions(options));
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

function buildImportOptions(options: PluginImportOptions): ImportOptions {
  const getWorkspaceId = () => Promise.resolve(options.workspaceId || null);
  const getWorkspaceScope = options.scope && (() => Promise.resolve(options.scope));
  return { getWorkspaceId, getWorkspaceScope };
}

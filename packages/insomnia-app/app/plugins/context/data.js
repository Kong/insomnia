// @flow
import {
  exportWorkspacesHAR,
  exportWorkspacesData,
  importRaw,
  importUri,
} from '../../common/import';
import type { Workspace, WorkspaceScope } from '../../models/workspace';

type ImportOptions = { workspaceId?: string, scope?: WorkspaceScope };

export function init(): { data: { import: Object, export: Object } } {
  return {
    data: {
      import: {
        async uri(uri: string, options: ImportOptions = {}): Promise<void> {
          const { getWorkspaceId, getWorkspaceScope } = buildImportCallbacks(options);
          await importUri(getWorkspaceId, uri, getWorkspaceScope);
        },
        async raw(text: string, options: ImportOptions = {}): Promise<void> {
          const { getWorkspaceId, getWorkspaceScope } = buildImportCallbacks(options);
          await importRaw(getWorkspaceId, text, getWorkspaceScope);
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

type ImportCallbacks = {
  getWorkspaceId: () => Promise<string | null>,
  getWorkspaceScope?: () => Promise<WorkspaceScope>,
};

function buildImportCallbacks(options: ImportOptions): ImportCallbacks {
  const getWorkspaceId = () => Promise.resolve(options.workspaceId || null);
  const getWorkspaceScope = options.scope && (() => Promise.resolve(options.scope));
  return { getWorkspaceId, getWorkspaceScope };
}

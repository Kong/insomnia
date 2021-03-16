// @flow
import {
  exportWorkspacesHAR,
  exportWorkspacesData,
  importRaw,
  importUri,
} from '../../common/import';
import type { Workspace } from '../../models/workspace';

export function init(): { data: { import: Object, export: Object } } {
  return {
    data: {
      import: {
        async uri(uri: string, options: { workspaceId?: string } = {}): Promise<void> {
          await importUri(() => Promise.resolve(options.workspaceId || null), uri);
        },
        async raw(text: string, options: { workspaceId?: string } = {}): Promise<void> {
          await importRaw(() => Promise.resolve(options.workspaceId || null), text);
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

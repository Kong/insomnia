// @flow
import {
  exportWorkspacesHAR,
  exportWorkspacesData,
  importRaw,
  importUri,
} from '../../common/import';

export function init(): { import: Object, export: Object } {
  return {
    import: {
      async uri(uri: string, options: { workspaceId?: string } = {}): Promise<void> {
        await importUri(options.workspaceId || null, uri);
      },
      async raw(text: string, options: { workspaceId?: string } = {}): Promise<void> {
        await importRaw(options.workspaceId || null, text);
      },
    },
    export: {
      async insomnia(
        options: { includePrivate?: boolean, format?: 'json' | 'yaml' } = {},
      ): Promise<string> {
        options = options || {};
        return exportWorkspacesData(null, !!options.includePrivate, options.format || 'json');
      },
      async har(options: { includePrivate?: boolean } = {}): Promise<string> {
        return exportWorkspacesHAR(null, !!options.includePrivate);
      },
    },
  };
}

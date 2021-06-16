import { exportWorkspacesHAR, exportWorkspacesData } from '../../common/export';
import { importRaw, importUri } from '../../common/import';
import type { Workspace, WorkspaceScope } from '../../models/workspace';
import type { ImportRawConfig } from '../../common/import';

interface PluginImportOptions {
  workspaceId?: string;
  scope?: WorkspaceScope;
}

interface InsomniaExport {
  workspaces?: Workspace[];
  includePrivate?: boolean;
  format?: 'json' | 'yaml';
}

type HarExport = Omit<InsomniaExport, 'format'>;

const buildImportRawConfig = (options: PluginImportOptions): ImportRawConfig => ({
  getWorkspaceId: () => Promise.resolve(options.workspaceId || null),
  getWorkspaceScope: options.scope && (() => (
    Promise.resolve<WorkspaceScope>(options.scope as WorkspaceScope))
  ),
});

export const init = () => ({
  data: {
    import: {
      uri: async (uri: string, options: PluginImportOptions = {}) => {
        await importUri(uri, buildImportRawConfig(options));
      },
      raw: async (text: string, options: PluginImportOptions = {}) => {
        await importRaw(text, buildImportRawConfig(options));
      },
    },
    export: {
      insomnia: async ({
        workspaces = [],
        includePrivate,
        format,
      }: InsomniaExport = {}) => exportWorkspacesData(
        workspaces,
        Boolean(includePrivate),
        format || 'json',
      ),

      har: async ({
        workspaces = [],
        includePrivate,
      }: HarExport = {}) => exportWorkspacesHAR(
        workspaces,
        Boolean(includePrivate),
      ),
    },
  },
});

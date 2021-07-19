import { exportWorkspacesHAR, exportWorkspacesData } from '../../common/export';
import { importRaw, importUri } from '../../common/import';
import type { Workspace, WorkspaceScope } from '../../models/workspace';
import type { ImportRawConfig } from '../../common/import';
import * as models from '../../models';
import { BASE_SPACE_ID } from '../../models/space';

interface PluginImportOptions {
  workspaceId?: string;
  scope?: WorkspaceScope;
}

interface InsomniaExport {
  workspace?: Workspace;
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

// Preserve existing behavior by getting workspaces in the base space if no workspace is provided to the export helpers
// This is done to avoid a breaking change to the plugin API at this time but ideally we should improve the API when the time comes
const getWorkspacesInBaseSpace = () => models.workspace.findByParentId(BASE_SPACE_ID);

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
        workspace,
        includePrivate,
        format,
      }: InsomniaExport = {}) => exportWorkspacesData(
        workspace ? [workspace] : await getWorkspacesInBaseSpace(),
        Boolean(includePrivate),
        format || 'json',
      ),

      har: async ({
        workspace,
        includePrivate,
      }: HarExport = {}) => exportWorkspacesHAR(
        workspace ? [workspace] : await getWorkspacesInBaseSpace(),
        Boolean(includePrivate),
      ),
    },
  },
});

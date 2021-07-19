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

// TODO: add metrics here to track how frequently this fallback is being used
const getWorkspacesInActiveSpace = (activeSpaceId: string) => models.workspace.findByParentId(activeSpaceId);

export const init = (activeSpaceId: string) => ({
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
        workspace ? [workspace] : await getWorkspacesInActiveSpace(activeSpaceId),
        Boolean(includePrivate),
        format || 'json',
      ),

      har: async ({
        workspace,
        includePrivate,
      }: HarExport = {}) => exportWorkspacesHAR(
        workspace ? [workspace] : await getWorkspacesInActiveSpace(activeSpaceId),
        Boolean(includePrivate),
      ),
    },
  },
});

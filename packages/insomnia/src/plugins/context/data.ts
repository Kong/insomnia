import { exportWorkspacesData, exportWorkspacesHAR } from '../../common/export';
import { fetchImportContentFromURI, importResources, scanResources } from '../../common/import';
import * as models from '../../models';
import type { Workspace, WorkspaceScope } from '../../models/workspace';

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

const getWorkspaces = (activeProjectId?: string) => {
  if (activeProjectId) {
    return models.workspace.findByParentId(activeProjectId);
  } else {
    // This code path was kept in case there was ever a time when the app wouldn't have an active project.
    // In over 5 months of monitoring in production, we never saw this happen.
    // Keeping it for defensive purposes, but it's not clear if it's necessary.
    return models.workspace.all();
  }
};

// Only in the case of running unit tests from Inso via send-request can activeProjectId be undefined. This is because the concept of a project doesn't exist in git/insomnia sync or an export file
export const init = (activeProjectId?: string) => ({
  data: {
    import: {
      uri: async (uri: string, options: PluginImportOptions = {}) => {
        if (!activeProjectId) {
          return;
        }

        const content = await fetchImportContentFromURI({
          uri,
        });

        await scanResources({
          content,
        });

        await importResources({
          projectId: activeProjectId,
          workspaceId: options.workspaceId,
        });
      },
      raw: async (content: string, options: PluginImportOptions = {}) => {
        if (!activeProjectId) {
          return;
        }
        await scanResources({
          content,
        });

        await importResources({
          projectId: activeProjectId,
          workspaceId: options.workspaceId,
        });
      },
    },
    export: {
      insomnia: async ({
        workspace,
        includePrivate,
        format,
      }: InsomniaExport = {}) => exportWorkspacesData(
        workspace ? [workspace] : await getWorkspaces(activeProjectId),
        Boolean(includePrivate),
        format || 'json',
      ),

      har: async ({
        workspace,
        includePrivate,
      }: HarExport = {}) => exportWorkspacesHAR(
        workspace ? [workspace] : await getWorkspaces(activeProjectId),
        Boolean(includePrivate),
      ),
    },
  },
});

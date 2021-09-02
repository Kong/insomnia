import { SegmentEvent, trackSegmentEvent } from '../../common/analytics';
import { exportWorkspacesData, exportWorkspacesHAR } from '../../common/export';
import type { ImportRawConfig } from '../../common/import';
import { importRaw, importUri } from '../../common/import';
import * as models from '../../models';
import { DEFAULT_PROJECT_ID } from '../../models/project';
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

const buildImportRawConfig = (options: PluginImportOptions, activeProjectId: string): ImportRawConfig => ({
  getWorkspaceId: () => Promise.resolve(options.workspaceId || null),
  getWorkspaceScope: options.scope && (() => (
    Promise.resolve<WorkspaceScope>(options.scope as WorkspaceScope))
  ),
  getProjectId: () => Promise.resolve(activeProjectId),
});

const getWorkspaces = (activeProjectId?: string) => {
  if (activeProjectId) {
    trackSegmentEvent(SegmentEvent.pluginExportLoadWorkspacesInProject);
    return models.workspace.findByParentId(activeProjectId);
  } else {
    trackSegmentEvent(SegmentEvent.pluginExportLoadAllWokspace);
    return models.workspace.all();
  }
};

// Only in the case of running unit tests from Inso via send-request can activeProjectId be undefined. This is because the concept of a project doesn't exist in git/insomnia sync or an export file
export const init = (activeProjectId?: string) => ({
  data: {
    import: {
      uri: async (uri: string, options: PluginImportOptions = {}) => {
        await importUri(uri, buildImportRawConfig(options, activeProjectId || DEFAULT_PROJECT_ID));
      },
      raw: async (text: string, options: PluginImportOptions = {}) => {
        await importRaw(text, buildImportRawConfig(options, activeProjectId || DEFAULT_PROJECT_ID));
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

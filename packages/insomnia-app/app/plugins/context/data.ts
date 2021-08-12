import { trackSegmentEvent } from '../../common/analytics';
import { exportWorkspacesData, exportWorkspacesHAR } from '../../common/export';
import type { ImportRawConfig } from '../../common/import';
import { importRaw, importUri } from '../../common/import';
import { SegmentEvent } from '../../common/segment-event';
import * as models from '../../models';
import { BASE_SPACE_ID } from '../../models/space';
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

const buildImportRawConfig = (options: PluginImportOptions, activeSpaceId: string): ImportRawConfig => ({
  getWorkspaceId: () => Promise.resolve(options.workspaceId || null),
  getWorkspaceScope: options.scope && (() => (
    Promise.resolve<WorkspaceScope>(options.scope as WorkspaceScope))
  ),
  getSpaceId: () => Promise.resolve(activeSpaceId),
});

const getWorkspaces = (activeSpaceId?: string) => {
  if (activeSpaceId) {
    trackSegmentEvent(SegmentEvent.pluginExportLoadWorkspacesInSpace);
    return models.workspace.findByParentId(activeSpaceId);
  } else {
    trackSegmentEvent(SegmentEvent.pluginExportLoadAllWokspace);
    return models.workspace.all();
  }
};

// Only in the case of running unit tests from Inso via send-request can activeSpaceId be undefined. This is because the concept of a space doesn't exist in git/insomnia sync or an export file
export const init = (activeSpaceId?: string) => ({
  data: {
    import: {
      uri: async (uri: string, options: PluginImportOptions = {}) => {
        await importUri(uri, buildImportRawConfig(options, activeSpaceId || BASE_SPACE_ID));
      },
      raw: async (text: string, options: PluginImportOptions = {}) => {
        await importRaw(text, buildImportRawConfig(options, activeSpaceId || BASE_SPACE_ID));
      },
    },
    export: {
      insomnia: async ({
        workspace,
        includePrivate,
        format,
      }: InsomniaExport = {}) => exportWorkspacesData(
        workspace ? [workspace] : await getWorkspaces(activeSpaceId),
        Boolean(includePrivate),
        format || 'json',
      ),

      har: async ({
        workspace,
        includePrivate,
      }: HarExport = {}) => exportWorkspacesHAR(
        workspace ? [workspace] : await getWorkspaces(activeSpaceId),
        Boolean(includePrivate),
      ),
    },
  },
});

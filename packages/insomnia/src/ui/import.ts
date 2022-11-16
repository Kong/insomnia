import electron, { OpenDialogOptions } from 'electron';

import {
  askToImportIntoProject,
  askToImportIntoWorkspace,
  askToSetWorkspaceScope,
  ForceToWorkspace,
  importRaw,
  importUri as _importUri,
} from '../common/import';
import * as models from '../models';
import { DEFAULT_PROJECT_ID, Project } from '../models/project';
import { Workspace, WorkspaceScope } from '../models/workspace';
import { showError, showModal } from './components/modals';
import { AlertModal } from './components/modals/alert-modal';

export interface ImportOptions {
  workspaceId?: string;
  forceToProject?: 'active' | 'prompt';
  forceToWorkspace?: ForceToWorkspace;
  forceToScope?: WorkspaceScope;
  onComplete?: () => void;
  activeProject?: Project;
  activeProjectWorkspaces?: Workspace[];
  projects?: Project[];
}

export const importFile = async (
  {
    forceToScope,
    forceToWorkspace,
    workspaceId,
    forceToProject,
    activeProject,
    activeProjectWorkspaces,
    projects,
    onComplete,
  }: ImportOptions = {},
) => {
  const openDialogOptions: OpenDialogOptions = {
    title: 'Import Insomnia Data',
    buttonLabel: 'Import',
    properties: ['openFile'],
    filters: [
      // @ts-expect-error https://github.com/electron/electron/pull/29322
      {
        extensions: [
          '',
          'sh',
          'txt',
          'json',
          'har',
          'curl',
          'bash',
          'shell',
          'yaml',
          'yml',
          'wsdl',
        ],
      },
    ],
  };
  const { canceled, filePaths } = await window.dialog.showOpenDialog(openDialogOptions);

  if (canceled) {
    // It was cancelled, so let's bail out
    return;
  }
  // Let's import all the files!
  for (const filePath of filePaths) {
    try {
      const uri = `file://${filePath}`;
      const config = {
        getWorkspaceScope: askToSetWorkspaceScope(forceToScope),
        getWorkspaceId: askToImportIntoWorkspace({ workspaceId, forceToWorkspace, activeProjectWorkspaces }),
        // Currently, just return the active project instead of prompting for which project to import into
        getProjectId: forceToProject === 'prompt' ? askToImportIntoProject({ projects, activeProject }) : () => Promise.resolve(activeProject?._id || DEFAULT_PROJECT_ID),
      };
      const { error, summary } = await _importUri(uri, config);
      if (!error) {
        models.stats.incrementRequestStats({ createdRequests: summary[models.request.type].length + summary[models.grpcRequest.type].length });
      }
      if (error) {
        showError({
          title: 'Import Failed',
          message: 'The file does not contain a valid specification.',
          error,
        });
      }
    } catch (err) {
      showModal(AlertModal, {
        title: 'Import Failed',
        message: err + '',
      });
    }
  }

  onComplete?.();
};

export const importClipBoard = async ({
  forceToScope,
  forceToWorkspace,
  workspaceId,
  forceToProject,
  activeProject,
  activeProjectWorkspaces,
  projects,
  onComplete,
}: ImportOptions = {},
) => {
  const schema = electron.clipboard.readText();

  if (!schema) {
    showModal(AlertModal, {
      title: 'Import Failed',
      message: 'Your clipboard appears to be empty.',
    });
    return;

  }

  // Let's import all the paths!
  try {
    const config = {
      getWorkspaceScope: askToSetWorkspaceScope(forceToScope),
      getWorkspaceId: askToImportIntoWorkspace({ workspaceId, forceToWorkspace, activeProjectWorkspaces }),
      // Currently, just return the active project instead of prompting for which project to import into
      getProjectId: forceToProject === 'prompt' ? askToImportIntoProject({ projects, activeProject }) : () => Promise.resolve(activeProject?._id || DEFAULT_PROJECT_ID),
    };
    const { error, summary } = await importRaw(schema, config);
    if (!error) {
      models.stats.incrementRequestStats({ createdRequests: summary[models.request.type].length + summary[models.grpcRequest.type].length });
    }
    if (error) {
      showError({
        title: 'Import Failed',
        message: 'Your clipboard does not contain a valid specification.',
        error,
      });
    }
  } catch (err) {
    showModal(AlertModal, {
      title: 'Import Failed',
      message: 'Your clipboard does not contain a valid specification.',
    });
  }

  onComplete?.();
};

export const importUri = async (
  uri: string,
  {
    forceToScope,
    forceToWorkspace,
    workspaceId,
    forceToProject,
    activeProject,
    activeProjectWorkspaces,
    projects,
    onComplete,
  }: ImportOptions = {},
) => {

  try {
    const config = {
      getWorkspaceScope: askToSetWorkspaceScope(forceToScope),
      getWorkspaceId: askToImportIntoWorkspace({ workspaceId, forceToWorkspace, activeProjectWorkspaces }),
      // Currently, just return the active project instead of prompting for which project to import into
      getProjectId: forceToProject === 'prompt' ? askToImportIntoProject({ projects, activeProject }) : () => Promise.resolve(activeProject?._id || DEFAULT_PROJECT_ID),
    };
    const { error, summary } = await _importUri(uri, config);
    if (!error) {
      models.stats.incrementRequestStats({ createdRequests: summary[models.request.type].length + summary[models.grpcRequest.type].length });
    }
    if (error) {
      showError({
        title: 'Import Failed',
        message: 'The URI does not contain a valid specification.',
        error,
      });
    }
  } catch (err) {
    showModal(AlertModal, {
      title: 'Import Failed',
      message: err + '',
    });
  }

  onComplete?.();
};

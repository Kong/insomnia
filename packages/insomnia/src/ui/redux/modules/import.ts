import electron, { OpenDialogOptions } from 'electron';
import { AnyAction } from 'redux';
import { ThunkAction } from 'redux-thunk';

import {
  askToImportIntoProject,
  askToImportIntoWorkspace,
  askToSetWorkspaceScope,
  ForceToWorkspace,
  importRaw,
  ImportRawConfig,
  ImportResult,
  importUri as _importUri,
} from '../../../common/import';
import * as models from '../../../models';
import { DEFAULT_PROJECT_ID, Project } from '../../../models/project';
import { Workspace, WorkspaceScope } from '../../../models/workspace';
import { showError, showModal } from '../../components/modals';
import { AlertModal } from '../../components/modals/alert-modal';
import { selectActiveProject, selectProjects, selectWorkspacesWithResolvedNameForActiveProject } from '../selectors';
import { RootState } from '.';

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

const handleImportResult = (result: ImportResult, errorMessage: string) => {
  const { error, summary } = result;

  if (error) {
    showError({
      title: 'Import Failed',
      message: errorMessage,
      error,
    });
    return [];
  }

  models.stats.incrementRequestStats({
    createdRequests: summary[models.request.type].length + summary[models.grpcRequest.type].length,
  });
  return (summary[models.workspace.type] as Workspace[]) || [];
};

const convertToRawConfig = ({
  forceToScope,
  forceToWorkspace,
  workspaceId,
  forceToProject,
  activeProject,
  activeProjectWorkspaces,
  projects,
}: ImportOptions): ImportRawConfig => {

  return ({
    getWorkspaceScope: askToSetWorkspaceScope(forceToScope),
    getWorkspaceId: askToImportIntoWorkspace({ workspaceId, forceToWorkspace, activeProjectWorkspaces }),
    // Currently, just return the active project instead of prompting for which project to import into
    getProjectId: forceToProject === 'prompt' ? askToImportIntoProject({ projects, activeProject }) : () => Promise.resolve(activeProject?._id || DEFAULT_PROJECT_ID),
  });
};

export const importFile = (
  options: ImportOptions = {},
): ThunkAction<void, RootState, void, AnyAction> => async (_, getState) => {
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
  const state = getState();
  const activeProject = selectActiveProject(state);
  const activeProjectWorkspaces = selectWorkspacesWithResolvedNameForActiveProject(state);
  const projects = selectProjects(state);
  // Let's import all the files!
  for (const filePath of filePaths) {
    try {
      const uri = `file://${filePath}`;
      const config = convertToRawConfig({ ...options, activeProject, activeProjectWorkspaces, projects });
      const result = await _importUri(uri, config);
      handleImportResult(result, 'The file does not contain a valid specification.');
    } catch (err) {
      showModal(AlertModal, {
        title: 'Import Failed',
        message: err + '',
      });
    }
  }

  options.onComplete?.();
};

export const readFromClipBoard = () => {
  const schema = electron.clipboard.readText();

  if (!schema) {
    showModal(AlertModal, {
      title: 'Import Failed',
      message: 'Your clipboard appears to be empty.',
    });
  }

  return schema;
};

export const importClipBoard = (
  options: ImportOptions = {},
): ThunkAction<void, RootState, void, AnyAction> => async (_, getState) => {
  const schema = readFromClipBoard();
  if (!schema) {
    return;
  }
  const state = getState();
  const activeProject = selectActiveProject(state);
  const activeProjectWorkspaces = selectWorkspacesWithResolvedNameForActiveProject(state);
  const projects = selectProjects(state);
  // Let's import all the paths!
  try {
    const config = convertToRawConfig({ ...options, activeProject, activeProjectWorkspaces, projects });
    const result = await importRaw(schema, config);
    handleImportResult(result, 'Your clipboard does not contain a valid specification.');
  } catch (err) {
    showModal(AlertModal, {
      title: 'Import Failed',
      message: 'Your clipboard does not contain a valid specification.',
    });
  }

  options.onComplete?.();
};

export const importUri = (
  uri: string,
  options: ImportOptions = {},
): ThunkAction<void, RootState, void, AnyAction> => async (_, getState) => {
  const state = getState();
  const activeProject = selectActiveProject(state);
  const activeProjectWorkspaces = selectWorkspacesWithResolvedNameForActiveProject(state);
  const projects = selectProjects(state);
  try {
    const config = convertToRawConfig({ ...options, activeProject, activeProjectWorkspaces, projects });
    const result = await _importUri(uri, config);
    handleImportResult(result, 'The URI does not contain a valid specification.');
  } catch (err) {
    showModal(AlertModal, {
      title: 'Import Failed',
      message: err + '',
    });
  }

  options.onComplete?.();
};

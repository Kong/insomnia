import electron, { OpenDialogOptions } from 'electron';
import { AnyAction } from 'redux';
import { ThunkAction } from 'redux-thunk';

import {
  importRaw,
  ImportRawConfig,
  ImportResult,
  importUri as _importUri,
} from '../../../common/import';
import * as models from '../../../models';
import { Workspace, WorkspaceScope } from '../../../models/workspace';
import { showError, showModal } from '../../components/modals';
import AlertModal from '../../components/modals/alert-modal';
import { selectActiveProject, selectProjects } from '../selectors';
import { RootState } from '.';
import { loadStart, loadStop } from './global';
import { askToImportIntoProject, askToImportIntoWorkspace, askToSetWorkspaceScope, ForceToWorkspace } from './helpers';

export interface ImportOptions {
  workspaceId?: string;
  forceToProject?: 'active' | 'prompt';
  forceToWorkspace?: ForceToWorkspace;
  forceToScope?: WorkspaceScope;
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
}: ImportOptions,
state: RootState): ImportRawConfig => {
  const activeProject = selectActiveProject(state);
  const projects = selectProjects(state);

  return ({
    getWorkspaceScope: askToSetWorkspaceScope(forceToScope),
    getWorkspaceId: askToImportIntoWorkspace({ workspaceId, forceToWorkspace }),
    // Currently, just return the active project instead of prompting for which project to import into
    getProjectId: forceToProject === 'prompt' ? askToImportIntoProject({ projects, activeProject }) : () => Promise.resolve(activeProject._id),
  });
};

export const importFile = (
  options: ImportOptions = {},
): ThunkAction<void, RootState, void, AnyAction> => async (dispatch, getState) => {
  dispatch(loadStart());

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
  const { canceled, filePaths } = await electron.remote.dialog.showOpenDialog(openDialogOptions);

  if (canceled) {
    // It was cancelled, so let's bail out
    dispatch(loadStop());
    return;
  }

  // Let's import all the files!
  for (const filePath of filePaths) {
    try {
      const uri = `file://${filePath}`;
      const config = convertToRawConfig(options, getState());
      const result = await _importUri(uri, config);
      handleImportResult(result, 'The file does not contain a valid specification.');
    } catch (err) {
      showModal(AlertModal, {
        title: 'Import Failed',
        message: err + '',
      });
    } finally {
      dispatch(loadStop());
    }
  }
};

export const importClipBoard = (
  options: ImportOptions = {},
): ThunkAction<void, RootState, void, AnyAction> => async (dispatch, getState) => {
  dispatch(loadStart());
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
    const config = convertToRawConfig(options, getState());
    const result = await importRaw(schema, config);
    handleImportResult(result, 'Your clipboard does not contain a valid specification.');
  } catch (err) {
    showModal(AlertModal, {
      title: 'Import Failed',
      message: 'Your clipboard does not contain a valid specification.',
    });
  } finally {
    dispatch(loadStop());
  }
};

export const importUri = (
  uri: string,
  options: ImportOptions = {},
): ThunkAction<void, RootState, void, AnyAction> => async (dispatch, getState) => {
  dispatch(loadStart());
  try {
    const config = convertToRawConfig(options, getState());
    const result = await _importUri(uri, config);
    handleImportResult(result, 'The URI does not contain a valid specification.');
  } catch (err) {
    showModal(AlertModal, {
      title: 'Import Failed',
      message: err + '',
    });
  } finally {
    dispatch(loadStop());
  }
};

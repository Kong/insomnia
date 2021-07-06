import electron, { OpenDialogOptions } from 'electron';
import { Dispatch } from 'redux';
import {
  ImportRawConfig,
  ImportResult,
  importRaw,
  importUri as _importUri,
} from '../../../common/import';
import { WorkspaceScope, Workspace } from '../../../models/workspace';
import { showModal, showError } from '../../components/modals';
import AlertModal from '../../components/modals/alert-modal';
import { loadStart, loadStop } from './global';
import { ForceToWorkspace, askToSetWorkspaceScope, askToImportIntoWorkspace } from './helpers';
import * as models from '../../../models';

export interface ImportOptions {
  workspaceId?: string;
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

export const importFile = (
  { workspaceId, forceToScope, forceToWorkspace }: ImportOptions = {},
) => async (dispatch: Dispatch) => {
  dispatch(loadStart());
  const options: OpenDialogOptions = {
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
  const { canceled, filePaths } = await electron.remote.dialog.showOpenDialog(options);

  if (canceled) {
    // It was cancelled, so let's bail out
    dispatch(loadStop());
    return;
  }

  // Let's import all the files!
  for (const filePath of filePaths) {
    try {
      const uri = `file://${filePath}`;
      const options: ImportRawConfig = {
        getWorkspaceScope: askToSetWorkspaceScope(forceToScope),
        getWorkspaceId: askToImportIntoWorkspace({ workspaceId, forceToWorkspace }),
      };
      const result = await _importUri(uri, options);
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
  { forceToScope, forceToWorkspace, workspaceId }: ImportOptions = {},
) => async (dispatch: Dispatch) => {
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
    const options: ImportRawConfig = {
      getWorkspaceScope: askToSetWorkspaceScope(forceToScope),
      getWorkspaceId: askToImportIntoWorkspace({ workspaceId, forceToWorkspace }),
    };
    const result = await importRaw(schema, options);
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
  { forceToScope, forceToWorkspace, workspaceId }: ImportOptions = {},
) => async (dispatch: Dispatch) => {
  dispatch(loadStart());

  try {
    const options: ImportRawConfig = {
      getWorkspaceScope: askToSetWorkspaceScope(forceToScope),
      getWorkspaceId: askToImportIntoWorkspace({ workspaceId, forceToWorkspace }),
    };
    const result = await _importUri(uri, options);
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

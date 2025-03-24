import { format } from 'date-fns';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import React from 'react';

import { type Environment } from '../models/environment';
import * as requestOperations from '../models/helpers/request-operations';
import { type BaseModel, environment } from '../models/index';
import * as models from '../models/index';
import { isRequest } from '../models/request';
import { isWorkspace, type Workspace } from '../models/workspace';
import { SegmentEvent } from '../ui/analytics';
import { showAlert, showError, showModal } from '../ui/components/modals';
import { AskModal } from '../ui/components/modals/ask-modal';
import { SelectModal } from '../ui/components/modals/select-modal';
import { database, database as db } from './database';
import * as har from './har';
import { getInsomniaV5DataExport } from './insomnia-v5';
import { strings } from './strings';

const getDocWithDescendants = (includePrivateDocs = false) => async (parentDoc: BaseModel | null) => {
  const docs = await db.withDescendants(parentDoc);
  return docs.filter(
    // Don't include if private, except if we want to
    doc => !doc?.isPrivate || includePrivateDocs,
  );
};

export async function exportWorkspacesHAR(
  workspaces: Workspace[],
  includePrivateDocs = false,
) {
  const promises = workspaces.map(getDocWithDescendants(includePrivateDocs));
  const docs = (await Promise.all(promises)).flat();
  const requests = docs.filter(isRequest);
  return exportRequestsHAR(requests, includePrivateDocs);
}

export async function exportRequestsHAR(
  requests: BaseModel[],
  includePrivateDocs = false,
) {
  const workspaces: BaseModel[] = [];
  const mapRequestIdToWorkspace: Record<string, any> = {};
  const workspaceLookup: Record<string, any> = {};

  for (const request of requests) {
    const ancestors: BaseModel[] = await db.withAncestors(request, [
      models.workspace.type,
      models.requestGroup.type,
    ]);
    const workspace = ancestors.find(isWorkspace);
    mapRequestIdToWorkspace[request._id] = workspace;

    if (workspace == null || workspaceLookup.hasOwnProperty(workspace._id)) {
      continue;
    }

    workspaceLookup[workspace._id] = true;
    workspaces.push(workspace);
  }

  const mapWorkspaceIdToEnvironmentId: Record<string, any> = {};

  for (const workspace of workspaces) {
    const workspaceMeta = await models.workspaceMeta.getByParentId(workspace._id);
    let environmentId = workspaceMeta ? workspaceMeta.activeEnvironmentId : null;
    const environment = await models.environment.getById(environmentId || 'n/a');

    if (!environment || (environment.isPrivate && !includePrivateDocs)) {
      environmentId = 'n/a';
    }

    mapWorkspaceIdToEnvironmentId[workspace._id] = environmentId;
  }

  requests = requests.sort((a: Record<string, any>, b: Record<string, any>) =>
    a.metaSortKey < b.metaSortKey ? -1 : 1,
  );
  const harRequests: har.ExportRequest[] = [];

  for (const request of requests) {
    const workspace = mapRequestIdToWorkspace[request._id];

    if (workspace == null) {
      // Workspace not found for request, so don't export it.
      continue;
    }

    const environmentId = mapWorkspaceIdToEnvironmentId[workspace._id];
    harRequests.push({
      requestId: request._id,
      environmentId: environmentId,
    });
  }

  const data = await har.exportHar(harRequests);
  return JSON.stringify(data, null, '\t');
}

const VALUE_YAML = 'yaml';
const VALUE_HAR = 'har';

export type SelectedFormat =
  | typeof VALUE_HAR
  | typeof VALUE_YAML
  ;

const showSelectExportTypeModal = ({ onDone }: {
  onDone: (selectedFormat: SelectedFormat) => Promise<void>;
}) => {
  const options = [
    {
      name: 'Insomnia v5',
      value: VALUE_YAML,
    },
    {
      name: 'HAR – HTTP Archive Format',
      value: VALUE_HAR,
    },
  ];

  let lastFormat = window.localStorage.getItem('insomnia.lastExportFormat');
  if (lastFormat === 'json') {
    window.localStorage.setItem('insomnia.lastExportFormat', VALUE_YAML);
    lastFormat = VALUE_YAML;
  }

  const defaultValue = options.find(({ value }) => value === lastFormat) ? lastFormat : VALUE_YAML;

  showModal(SelectModal, {
    title: 'Select Export Type',
    value: defaultValue,
    options,
    message: 'Which format would you like to export as?',
    onDone: async selectedFormat => {
      if (selectedFormat) {
        window.localStorage.setItem('insomnia.lastExportFormat', selectedFormat);
        await onDone(selectedFormat as SelectedFormat);
      }
    },
  });
};

const showExportPrivateEnvironmentsModal = async () => {
  return new Promise<boolean>(resolve => {
    showModal(AskModal, {
      title: 'Export Private Environments?',
      message: 'Do you want to include private environments in your export?',
      onDone: async (isYes: boolean) => {
        if (isYes) {
          resolve(true);
        } else {
          resolve(false);
        }
      },
    });
  });
};

const showSaveExportedFileDialog = async ({
  exportedFileNamePrefix,
  selectedFormat,
}: {
  exportedFileNamePrefix: string;
  selectedFormat: SelectedFormat;
}) => {
  const date = format(Date.now(), 'yyyy-MM-dd');
  const name = exportedFileNamePrefix.replace(/ /g, '-');
  const lastDir = window.localStorage.getItem('insomnia.lastExportPath');
  const dir = lastDir || window.app.getPath('desktop');
  const options = {
    title: 'Export Insomnia Data',
    buttonLabel: 'Export',
    defaultPath: `${path.join(dir, `${name}_${date}`)}.${selectedFormat}`,
  };
  const { filePath } = await window.dialog.showSaveDialog(options);
  return filePath || null;
};

const showSaveExportedFolderDialog = async () => {
  const lastDir = window.localStorage.getItem('insomnia.lastExportPath');
  const dir = lastDir || window.app.getPath('desktop');
  const options = {
    title: 'Export Insomnia Data',
    buttonLabel: 'Export',
    properties: ['openDirectory'],
    defaultPath: dir,
  } satisfies Electron.OpenDialogOptions;
  const { filePaths } = await window.dialog.showOpenDialog(options);
  const filePath = filePaths[0];

  return filePath || null;
};

async function writeExportedFileToFileSystem(filename: string, data: string) {
  // Remember last exported path
  window.localStorage.setItem('insomnia.lastExportPath', path.dirname(filename));
  await writeFile(filename, data);
};

export const exportProjectToFile = (activeProjectName: string, workspacesForActiveProject: Workspace[]) => {
  if (!workspacesForActiveProject.length) {
    showAlert({
      title: 'Cannot export',
      message: <>There are no workspaces to export in the <strong>{activeProjectName}</strong> {strings.project.singular.toLowerCase()}.</>,
    });
    return;
  }

  showSelectExportTypeModal({
    onDone: async selectedFormat => {
      const baseEnvironments = await database.find<Environment>(environment.type, {
        parentId: { $in: workspacesForActiveProject.map(w => w._id) },
      });

      const subEnvironments = await database.find<Environment>(environment.type, {
        parentId: { $in: baseEnvironments.map(w => w._id) },
      });
      const shouldPrompt = subEnvironments.some(e => e.isPrivate);
      let shouldExportPrivateEnvironments = false;
      if (shouldPrompt) {
        shouldExportPrivateEnvironments = await showExportPrivateEnvironmentsModal();
      }

      try {
        switch (selectedFormat) {
          case VALUE_HAR: {
            const fileName = await showSaveExportedFileDialog({
              exportedFileNamePrefix: activeProjectName,
              selectedFormat,
            });

            if (!fileName) {
              return;
            }
            const stringifiedExport = await exportWorkspacesHAR(workspacesForActiveProject, shouldExportPrivateEnvironments);

            await writeExportedFileToFileSystem(fileName, stringifiedExport);

            break;
          }

          case VALUE_YAML: {
            const dirPath = await showSaveExportedFolderDialog();
            if (!dirPath) {
              return;
            }

            if (!dirPath) {
              return;
            }

            const projectName = activeProjectName.replace(/ /g, '-');
            const insomniaProjectExportFolder = path.join(dirPath, `insomnia-export.${projectName}.${Date.now()}`);
            await mkdir(insomniaProjectExportFolder);

            for (const workspace of workspacesForActiveProject) {
              const workspaceName = workspace.name.replace(/ /g, '-');
              const fileName = path.join(insomniaProjectExportFolder, `${workspaceName}-${workspace._id}.yaml`);
              const stringifiedExport = await getInsomniaV5DataExport({ workspaceId: workspace._id, includePrivateEnvironments: shouldExportPrivateEnvironments });
              await writeExportedFileToFileSystem(fileName, stringifiedExport);
            }
            break;
          }

          default:
            throw new Error(`selected export format "${selectedFormat}" is invalid`);
        }
        window.main.trackSegmentEvent({ event: SegmentEvent.dataExport, properties: { type: selectedFormat } });
      } catch (err) {
        showError({
          title: 'Export Failed',
          error: err,
          message: 'Export failed due to an unexpected error',
        });
        return;
      }
    },
  });
};

export const exportMockServerToFile = async (workspace: Workspace) => {
  const fileName = await showSaveExportedFileDialog({
    exportedFileNamePrefix: workspace.name,
    selectedFormat: 'yaml',
  });
  if (!fileName) {
    return;
  }

  try {
    const stringifiedExport = await getInsomniaV5DataExport({ workspaceId: workspace._id, includePrivateEnvironments: false });
    await writeExportedFileToFileSystem(fileName, stringifiedExport);
    window.main.trackSegmentEvent({ event: SegmentEvent.dataExport, properties: { type: 'yaml', scope: 'mock-server' } });
  } catch (err) {
    showError({
      title: 'Export Failed',
      error: err,
      message: 'Export failed due to an unexpected error',
    });
    return;
  }
};

export const exportGlobalEnvironmentToFile = async (workspace: Workspace) => {
  const fileName = await showSaveExportedFileDialog({
    exportedFileNamePrefix: workspace.name,
    selectedFormat: 'yaml',
  });
  if (!fileName) {
    return;
  }

  const baseEnvironments = await database.find<Environment>(environment.type, {
    parentId: workspace._id,
  });

  const subEnvironments = await database.find<Environment>(environment.type, {
    parentId: { $in: baseEnvironments.map(w => w._id) },
  });
  const shouldPrompt = subEnvironments.some(e => e.isPrivate);
  let shouldExportPrivateEnvironments = false;
  if (shouldPrompt) {
    shouldExportPrivateEnvironments = await showExportPrivateEnvironmentsModal();
  }

  try {
    const stringifiedExport = await getInsomniaV5DataExport({ workspaceId: workspace._id, includePrivateEnvironments: shouldExportPrivateEnvironments });
    await writeExportedFileToFileSystem(fileName, stringifiedExport);
    window.main.trackSegmentEvent({ event: SegmentEvent.dataExport, properties: { type: 'yaml', scope: 'environment' } });
  } catch (err) {
    showError({
      title: 'Export Failed',
      error: err,
      message: 'Export failed due to an unexpected error',
    });
    return;
  }
};

export const exportRequestsToFile = (workspaceId: string, requestIds: string[]) => {
  showSelectExportTypeModal({
    onDone: async selectedFormat => {
      const requests: BaseModel[] = [];
      for (const requestId of requestIds) {
        const request = await requestOperations.getById(requestId);
        if (request) {
          requests.push(request);
        }
      }
      const [baseEnvironment] = await database.find<Environment>(environment.type, {
        parentId: workspaceId,
      });

      const subEnvironments = await database.find<Environment>(environment.type, {
        parentId: baseEnvironment?._id,
      });
      const shouldPrompt = subEnvironments.some(e => e.isPrivate);
      let shouldExportPrivateEnvironments = false;
      if (shouldPrompt) {
        shouldExportPrivateEnvironments = await showExportPrivateEnvironmentsModal();
      }
      const fileName = await showSaveExportedFileDialog({
        exportedFileNamePrefix: 'Insomnia',
        selectedFormat,
      });

      if (!fileName) {
        return;
      }

      let stringifiedExport = '';

      try {
        switch (selectedFormat) {
          case VALUE_HAR:
            stringifiedExport = await exportRequestsHAR(requests, shouldExportPrivateEnvironments);
            break;

          case VALUE_YAML:
            // @TODO - Export only selected requests
            stringifiedExport = await getInsomniaV5DataExport({ workspaceId, includePrivateEnvironments: shouldExportPrivateEnvironments });
            break;

          default:
            throw new Error(`selected export format "${selectedFormat}" is invalid`);
        }
        await writeExportedFileToFileSystem(fileName, stringifiedExport);
        window.main.trackSegmentEvent({ event: SegmentEvent.dataExport, properties: { type: selectedFormat } });
      } catch (err) {
        showError({
          title: 'Export Failed',
          error: err,
          message: 'Export failed due to an unexpected error',
        });
        return;
      }

    },
  });
};

export async function exportWorkspaceData({
  workspace,
  dirPath,
  includePrivateEnvironments,
}: {
  workspace: Workspace;
  dirPath: string;
  includePrivateEnvironments: boolean;
}) {
  const insomniaExport = await getInsomniaV5DataExport({ workspaceId: workspace._id, includePrivateEnvironments });

  try {
    const workspaceName = workspace.name.replace(/ /g, '-');
    const filePath = path.join(dirPath, `${workspaceName}-${workspace._id}.yaml`);
    await writeExportedFileToFileSystem(filePath, insomniaExport);
  } catch (error) {
    console.error(error);
  }
}

export async function exportAllData({
  dirPath,
}: {
  dirPath: string;
}): Promise<void> {
  const workspaces = await database.find<Workspace>(models.workspace.type);

  const baseEnvironments = await database.find<Environment>(environment.type, {
    parentId: { $in: workspaces.map(w => w._id) },
  });

  const subEnvironments = await database.find<Environment>(environment.type, {
    parentId: { $in: baseEnvironments.map(w => w._id) },
  });
  const shouldPrompt = subEnvironments.some(e => e.isPrivate);
  let includePrivateEnvironments = false;
  if (shouldPrompt) {
    includePrivateEnvironments = await showExportPrivateEnvironmentsModal();
  }

  const insomniaExportFolder = path.join(dirPath, `insomnia-export.${Date.now()}`);
  await mkdir(insomniaExportFolder);

  for (const workspace of workspaces) {
    await exportWorkspaceData({
      workspace,
      dirPath: insomniaExportFolder,
      includePrivateEnvironments,
    });
  }
}

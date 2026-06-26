import { format } from 'date-fns';
import { getInsomniaV5DataExport } from 'insomnia/src/common/insomnia-v5';
import { AnalyticsEvent } from 'insomnia/src/ui/analytics';
import { showError, showModal } from 'insomnia/src/ui/components/modals';
import { AskModal } from 'insomnia/src/ui/components/modals/ask-modal';
import { SelectModal } from 'insomnia/src/ui/components/modals/select-modal';
import type { BaseModel, Environment, Workspace } from 'insomnia-data';
import { database, models, services } from 'insomnia-data';
import { strings } from 'insomnia-data/common';
import React from 'react';

import { AlertModal } from '~/ui/components/modals/alert-modal';

const VALUE_YAML = 'yaml';
const VALUE_HAR = 'har';

export type SelectedFormat = typeof VALUE_HAR | typeof VALUE_YAML;

const showSelectExportTypeModal = ({ onDone }: { onDone: (selectedFormat: SelectedFormat) => Promise<void> }) => {
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
    defaultPath: `${window.path.join(dir, `${name}_${date}`)}.${selectedFormat}`,
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
  window.localStorage.setItem('insomnia.lastExportPath', window.path.dirname(filename));
  await window.main.writeFile({
    path: filename,
    content: data,
  });
}

export const exportProjectToFile = (activeProjectName: string, workspacesForActiveProject: Workspace[]) => {
  if (!workspacesForActiveProject.length) {
    showModal(AlertModal, {
      title: 'Cannot export',
      message: (
        <>
          There are no workspaces to export in the <strong>{activeProjectName}</strong>{' '}
          {strings.project.singular.toLowerCase()}.
        </>
      ),
    });
    return;
  }

  showSelectExportTypeModal({
    onDone: async selectedFormat => {
      const baseEnvironments = await database.find<Environment>(models.environment.type, {
        parentId: { $in: workspacesForActiveProject.map(w => w._id) },
      });

      const subEnvironments = await database.find<Environment>(models.environment.type, {
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
            const stringifiedExport = await window.main.exportWorkspacesHAR({
              workspaces: workspacesForActiveProject,
              includePrivateDocs: shouldExportPrivateEnvironments,
            });

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
            const insomniaProjectExportFolder = window.path.join(
              dirPath,
              `insomnia-export.${projectName}.${Date.now()}`,
            );

            for (const workspace of workspacesForActiveProject) {
              const workspaceName = workspace.name.replace(/ /g, '-');
              const fileName = window.path.join(insomniaProjectExportFolder, `${workspaceName}-${workspace._id}.yaml`);
              const stringifiedExport = await getInsomniaV5DataExport({
                workspaceId: workspace._id,
                includePrivateEnvironments: shouldExportPrivateEnvironments,
              });
              await writeExportedFileToFileSystem(fileName, stringifiedExport);
            }
            break;
          }

          default: {
            throw new Error(`selected export format "${selectedFormat}" is invalid`);
          }
        }
        window.main.trackAnalyticsEvent({ event: AnalyticsEvent.exportCompleted });
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
    const stringifiedExport = await getInsomniaV5DataExport({
      workspaceId: workspace._id,
      includePrivateEnvironments: false,
    });
    await writeExportedFileToFileSystem(fileName, stringifiedExport);
    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.dataExport,
      properties: { type: 'yaml', scope: 'mock-server' },
    });
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

  const baseEnvironments = await database.find<Environment>(models.environment.type, {
    parentId: workspace._id,
  });

  const subEnvironments = await database.find<Environment>(models.environment.type, {
    parentId: { $in: baseEnvironments.map(w => w._id) },
  });
  const shouldPrompt = subEnvironments.some(e => e.isPrivate);
  let shouldExportPrivateEnvironments = false;
  if (shouldPrompt) {
    shouldExportPrivateEnvironments = await showExportPrivateEnvironmentsModal();
  }

  try {
    const stringifiedExport = await getInsomniaV5DataExport({
      workspaceId: workspace._id,
      includePrivateEnvironments: shouldExportPrivateEnvironments,
    });
    await writeExportedFileToFileSystem(fileName, stringifiedExport);
    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.dataExport,
      properties: { type: 'yaml', scope: 'environment' },
    });
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
        const request = await services.helpers.getRequestById(requestId);
        if (request) {
          requests.push(request);
        }
      }
      const [baseEnvironment] = await database.find<Environment>(models.environment.type, {
        parentId: workspaceId,
      });

      const subEnvironments = await database.find<Environment>(models.environment.type, {
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
          case VALUE_HAR: {
            stringifiedExport = await window.main.exportRequestsHAR({
              requests,
              includePrivateDocs: shouldExportPrivateEnvironments,
            });
            break;
          }

          case VALUE_YAML: {
            stringifiedExport = await getInsomniaV5DataExport({
              workspaceId,
              includePrivateEnvironments: shouldExportPrivateEnvironments,
              requestIds,
            });
            break;
          }

          default: {
            throw new Error(`selected export format "${selectedFormat}" is invalid`);
          }
        }
        await writeExportedFileToFileSystem(fileName, stringifiedExport);
        window.main.trackAnalyticsEvent({ event: AnalyticsEvent.dataExport, properties: { type: selectedFormat } });
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

export const exportMcpClientToFile = async (workspace: Workspace) => {
  const fileName = await showSaveExportedFileDialog({
    exportedFileNamePrefix: workspace.name,
    selectedFormat: 'yaml',
  });
  if (!fileName) {
    return;
  }

  try {
    const stringifiedExport = await getInsomniaV5DataExport({
      workspaceId: workspace._id,
      includePrivateEnvironments: false,
    });
    await writeExportedFileToFileSystem(fileName, stringifiedExport);
    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.dataExport,
      properties: { type: 'yaml', scope: 'mcp' },
    });
  } catch (err) {
    showError({
      title: 'Export Failed',
      error: err,
      message: 'Export failed due to an unexpected error',
    });
    return;
  }
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
    const filePath = window.path.join(dirPath, `${workspaceName}-${workspace._id}.yaml`);
    await writeExportedFileToFileSystem(filePath, insomniaExport);
  } catch (error) {
    console.error(error);
  }
}

export async function exportAllData({ dirPath }: { dirPath: string }): Promise<void> {
  const workspaces = await database.find<Workspace>(models.workspace.type);

  const baseEnvironments = await database.find<Environment>(models.environment.type, {
    parentId: { $in: workspaces.map(w => w._id) },
  });

  const subEnvironments = await database.find<Environment>(models.environment.type, {
    parentId: { $in: baseEnvironments.map(w => w._id) },
  });
  const shouldPrompt = subEnvironments.some(e => e.isPrivate);
  let includePrivateEnvironments = false;
  if (shouldPrompt) {
    includePrivateEnvironments = await showExportPrivateEnvironmentsModal();
  }

  const insomniaExportFolder = window.path.join(dirPath, `insomnia-export.${Date.now()}`);

  for (const workspace of workspaces) {
    await exportWorkspaceData({
      workspace,
      dirPath: insomniaExportFolder,
      includePrivateEnvironments,
    });
  }
}

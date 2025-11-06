import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { format } from 'date-fns';
import { getProductName } from 'insomnia/src/common/constants';
import { database } from 'insomnia/src/common/database';
import { getWorkspaceLabel } from 'insomnia/src/common/get-workspace-label';
import { exportRequestsHAR, exportWorkspacesHAR } from 'insomnia/src/common/har';
import { getInsomniaV5DataExport } from 'insomnia/src/common/insomnia-v5';
import { isNotNullOrUndefined } from 'insomnia/src/common/misc';
import { strings } from 'insomnia/src/common/strings';
import { type Environment } from 'insomnia/src/models/environment';
import * as requestOperations from 'insomnia/src/models/helpers/request-operations';
import * as models from 'insomnia/src/models/index';
import { type BaseModel, environment } from 'insomnia/src/models/index';
import { isScratchpadOrganizationId, type Organization } from 'insomnia/src/models/organization';
import type { Project } from 'insomnia/src/models/project';
import { isMcp, isScratchpad, type Workspace } from 'insomnia/src/models/workspace';
import { SegmentEvent } from 'insomnia/src/ui/analytics';
import { Icon } from 'insomnia/src/ui/components/icon';
import { showError, showModal } from 'insomnia/src/ui/components/modals';
import { AskModal } from 'insomnia/src/ui/components/modals/ask-modal';
import { ExportRequestsModal } from 'insomnia/src/ui/components/modals/export-requests-modal';
import { ImportModal } from 'insomnia/src/ui/components/modals/import-modal/import-modal';
import { SelectModal } from 'insomnia/src/ui/components/modals/select-modal';
import React, { type FC, Fragment, useEffect, useState } from 'react';
import { Button, Heading, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components';
import { href, useParams } from 'react-router';

import { useRootLoaderData } from '~/root';
import { useOrganizationLoaderData } from '~/routes/organization';
import { useProjectListWorkspacesLoaderFetcher } from '~/routes/organization.$organizationId.project.$projectId.list-workspaces';
import { useProjectMoveActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.move';
import { useProjectMoveWorkspaceActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.move-workspace';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useUntrackedProjectsLoaderFetcher } from '~/routes/untracked-projects';
import { AlertModal } from '~/ui/components/modals/alert-modal';
import { ImportProjectsModal } from '~/ui/components/modals/import-modal/import-projects-modal';
import { useOrganizationPermissions } from '~/ui/hooks/use-organization-features';
import { usePlanData } from '~/ui/hooks/use-plan';

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
            const stringifiedExport = await exportWorkspacesHAR(
              workspacesForActiveProject,
              shouldExportPrivateEnvironments,
            );

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
        window.main.trackSegmentEvent({ event: SegmentEvent.exportCompleted });
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
    window.main.trackSegmentEvent({
      event: SegmentEvent.dataExport,
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
    const stringifiedExport = await getInsomniaV5DataExport({
      workspaceId: workspace._id,
      includePrivateEnvironments: shouldExportPrivateEnvironments,
    });
    await writeExportedFileToFileSystem(fileName, stringifiedExport);
    window.main.trackSegmentEvent({
      event: SegmentEvent.dataExport,
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
          case VALUE_HAR: {
            stringifiedExport = await exportRequestsHAR(requests, shouldExportPrivateEnvironments);
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

export async function exportAllData({ dirPath }: { dirPath: string }): Promise<void> {
  const workspaces = await database.find<Workspace>(models.workspace.type);

  const workspacesWithoutMcp = workspaces.filter(w => !isMcp(w));

  const baseEnvironments = await database.find<Environment>(environment.type, {
    parentId: { $in: workspacesWithoutMcp.map(w => w._id) },
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

  for (const workspace of workspacesWithoutMcp) {
    await exportWorkspaceData({
      workspace,
      dirPath: insomniaExportFolder,
      includePrivateEnvironments,
    });
  }
}

const UntrackedProject = ({
  project,
  organizationId,
  organizations,
}: {
  project: Project & { workspacesCount: number };
  organizationId: string;
  organizations: Organization[];
}) => {
  const moveProjectFetcher = useProjectMoveActionFetcher();
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);

  return (
    <div key={project._id} className="flex items-center justify-between gap-2 py-2">
      <div className="flex flex-col gap-1">
        <Heading className="flex items-center gap-2 text-base font-semibold">
          {project.name}
          <span className="text-xs text-(--hl)">Id: {project._id}</span>
        </Heading>
        <p className="text-sm">
          This project contains {project.workspacesCount} {project.workspacesCount === 1 ? 'file' : 'files'}.
        </p>
      </div>
      <moveProjectFetcher.Form
        action={href(`/organization/:organizationId/project/:projectId/move`, {
          organizationId,
          projectId: project._id,
        })}
        method="POST"
        className="group flex items-center gap-2"
      >
        <Select
          aria-label="Select an organization"
          name="organizationId"
          onSelectionChange={key => {
            key && setSelectedOrganizationId(key.toString());
          }}
          selectedKey={selectedOrganizationId}
          isDisabled={organizations.length === 0}
        >
          <Button className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) disabled:cursor-not-allowed disabled:bg-(--hl-xs) aria-pressed:bg-(--hl-sm) data-pressed:bg-(--hl-xs)">
            <SelectValue<Organization> className="flex items-center justify-center gap-2 truncate">
              {({ selectedItem }) => {
                if (!selectedItem) {
                  return (
                    <Fragment>
                      <span>Select an organization</span>
                    </Fragment>
                  );
                }

                return <Fragment>{selectedItem.display_name}</Fragment>;
              }}
            </SelectValue>
            <Icon icon="caret-down" />
          </Button>
          <Popover className="flex min-w-max flex-col overflow-y-hidden">
            <ListBox
              items={organizations}
              className="min-w-max select-none overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg focus:outline-hidden"
            >
              {item => (
                <ListBoxItem
                  id={item.id}
                  key={item.id}
                  className="flex h-(--line-height-xs) w-full items-center gap-2 whitespace-nowrap bg-transparent px-(--padding-md) text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                  aria-label={item.name}
                  textValue={item.name}
                  value={item}
                >
                  {({ isSelected }) => (
                    <Fragment>
                      {item.display_name}
                      {isSelected && <Icon icon="check" className="justify-self-end text-(--color-success)" />}
                    </Fragment>
                  )}
                </ListBoxItem>
              )}
            </ListBox>
          </Popover>
        </Select>
        <Button
          isDisabled={organizations.length === 0 || !selectedOrganizationId || moveProjectFetcher.state !== 'idle'}
          type="submit"
          className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) disabled:cursor-not-allowed disabled:bg-(--hl-xs) group-invalid:opacity-30 aria-pressed:bg-(--hl-sm)"
        >
          Move
        </Button>
      </moveProjectFetcher.Form>
    </div>
  );
};

const UntrackedWorkspace = ({
  workspace,
  organizationId,
  projects,
}: {
  workspace: Workspace;
  organizationId: string;
  projects: Project[];
}) => {
  const moveWorkspaceFetcher = useProjectMoveWorkspaceActionFetcher();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  return (
    <div key={workspace._id} className="flex items-center justify-between gap-2 py-2">
      <div className="flex flex-col gap-1">
        <Heading className="flex items-center gap-2 text-base font-semibold">
          {workspace.name}
          <span className="text-xs text-(--hl)">Id: {workspace._id}</span>
        </Heading>
      </div>
      <moveWorkspaceFetcher.Form
        action={href(`/organization/:organizationId/project/:projectId/move-workspace`, {
          organizationId,
          projectId: selectedProjectId || '',
        })}
        method="POST"
        className="group flex items-center gap-2"
      >
        <input type="hidden" name="workspaceId" value={workspace._id} />
        <Select
          aria-label="Select a project"
          name="projectId"
          onSelectionChange={key => {
            key && setSelectedProjectId(key.toString());
          }}
          selectedKey={selectedProjectId}
          isDisabled={projects.length === 0}
        >
          <Button className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) disabled:cursor-not-allowed disabled:bg-(--hl-xs) aria-pressed:bg-(--hl-sm) data-pressed:bg-(--hl-xs)">
            <SelectValue<Project> className="flex items-center justify-center gap-2 truncate">
              {({ selectedItem }) => {
                if (!selectedItem) {
                  return (
                    <Fragment>
                      <span>Select a project</span>
                    </Fragment>
                  );
                }

                return <Fragment>{selectedItem.name}</Fragment>;
              }}
            </SelectValue>
            <Icon icon="caret-down" />
          </Button>
          <Popover className="flex min-w-max flex-col overflow-y-hidden">
            <ListBox
              className="min-w-max select-none overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg focus:outline-hidden"
              items={projects.map(project => ({
                ...project,
                id: project._id,
              }))}
            >
              {item => (
                <ListBoxItem
                  id={item.id}
                  key={item.id}
                  className="flex h-(--line-height-xs) w-full items-center gap-2 whitespace-nowrap bg-transparent px-(--padding-md) text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                  aria-label={item.name}
                  textValue={item.name}
                  value={item}
                >
                  {({ isSelected }) => (
                    <Fragment>
                      {item.name}
                      {isSelected && <Icon icon="check" className="justify-self-end text-(--color-success)" />}
                    </Fragment>
                  )}
                </ListBoxItem>
              )}
            </ListBox>
          </Popover>
        </Select>
        <Button
          isDisabled={projects.length === 0 || !selectedProjectId || moveWorkspaceFetcher.state !== 'idle'}
          type="submit"
          className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) disabled:cursor-not-allowed disabled:bg-(--hl-xs) group-invalid:opacity-30 aria-pressed:bg-(--hl-sm)"
        >
          Move
        </Button>
      </moveWorkspaceFetcher.Form>
    </div>
  );
};

interface Props {
  hideSettingsModal: () => void;
  onModalChange?: (isOpen: boolean) => void;
}

export const ImportExport: FC<Props> = ({ hideSettingsModal, onModalChange }) => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId?: string;
  };
  const organizationData = useOrganizationLoaderData();
  const organizations = organizationData?.organizations || [];

  const { features } = useOrganizationPermissions();
  const { isEnterprisePlan } = usePlanData();

  const untrackedProjectsFetcher = useUntrackedProjectsLoaderFetcher();

  useEffect(() => {
    const isIdleAndUninitialized = untrackedProjectsFetcher.state === 'idle' && !untrackedProjectsFetcher.data;
    if (isIdleAndUninitialized) {
      untrackedProjectsFetcher.load();
    }
  }, [untrackedProjectsFetcher, organizationId]);

  const untrackedProjects = untrackedProjectsFetcher.data?.untrackedProjects || [];
  const untrackedWorkspaces = untrackedProjectsFetcher.data?.untrackedWorkspaces || [];

  const workspaceData = useWorkspaceLoaderData();
  const activeWorkspaceName = workspaceData?.activeWorkspace.name;
  const { workspaceCount, userSession, mcpWorkspaceCount } = useRootLoaderData()!;
  const workspacesFetcher = useProjectListWorkspacesLoaderFetcher();
  useEffect(() => {
    const isIdleAndUninitialized = workspacesFetcher.state === 'idle' && !workspacesFetcher.data;
    if (isIdleAndUninitialized && organizationId && projectId && !isScratchpadOrganizationId(organizationId)) {
      workspacesFetcher.load({
        organizationId,
        projectId,
      });
    }
  }, [organizationId, projectId, workspacesFetcher]);
  const projectLoaderData = workspacesFetcher?.data;
  const workspacesForActiveProject =
    projectLoaderData?.files
      .map(w => w.workspace)
      .filter(isNotNullOrUndefined)
      .filter(w => !isMcp(w)) || [];
  const activeProject = projectLoaderData?.activeProject;
  const projectName = activeProject?.name ?? getProductName();
  const projects = projectLoaderData?.projects || [];
  const organizationName =
    organizationData?.organizations.find(org => org.id === organizationId)?.display_name || 'Organization';

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isImportProjectsModalOpen, setIsImportProjectsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  useEffect(() => {
    onModalChange?.(isImportModalOpen || isImportProjectsModalOpen || isExportModalOpen);
  }, [isImportModalOpen, isImportProjectsModalOpen, isExportModalOpen, onModalChange]);

  const handleExportProjectToFile = () => {
    exportProjectToFile(projectName, workspacesForActiveProject);
    hideSettingsModal();
  };
  const isLoggedIn = userSession.id || organizationId || activeProject;
  const isScratchPadWorkspace = isScratchpad(workspaceData?.activeWorkspace);
  const hasUntrackedWorkspaces = untrackedWorkspaces.length > 0;
  const hasUntrackedProjects = untrackedProjects.length > 0;
  const showImportButtons =
    !isScratchPadWorkspace && (activeProject || features.bulkImport.enabled || isEnterprisePlan);
  if (!isScratchPadWorkspace && !isLoggedIn) {
    return (
      <Button
        className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) aria-pressed:bg-(--hl-sm)"
        onPress={async () => {
          const { filePaths, canceled } = await window.dialog.showOpenDialog({
            properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
            buttonLabel: 'Select',
            title: 'Export All Insomnia Data',
          });

          if (canceled) {
            return;
          }

          const [dirPath] = filePaths;

          try {
            dirPath &&
              (await exportAllData({
                dirPath,
              }));
          } catch (e) {
            showModal(AlertModal, {
              title: 'Export Failed',
              message: 'An error occurred while exporting data. Please try again.',
            });
            console.error(e);
          }

          showModal(AlertModal, {
            title: 'Export Complete',
            message: 'All your data have been successfully exported',
          });
          window.main.trackSegmentEvent({
            event: SegmentEvent.exportAllCollections,
          });
        }}
        aria-label="Export all data"
      >
        <Icon icon="file-export" />
        <span>Export all data {`(${workspaceCount - mcpWorkspaceCount} files)`}</span>
      </Button>
    );
  }

  return (
    <Fragment>
      <div data-testid="import-export-tab" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-md border border-solid border-(--hl-md) p-4">
          <Heading className="flex items-center gap-2 text-lg font-bold">
            <Icon icon="file-export" /> Export
          </Heading>
          <div className="flex flex-wrap gap-2">
            {activeProject &&
              (workspaceData?.activeWorkspace ? (
                <ExportSection
                  workspace={workspaceData.activeWorkspace}
                  projectName={projectName}
                  setIsExportModalOpen={setIsExportModalOpen}
                  handleExportProjectToFile={handleExportProjectToFile}
                />
              ) : (
                <Button
                  className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) aria-pressed:bg-(--hl-sm)"
                  onPress={handleExportProjectToFile}
                >
                  {`Export files from the "${projectName}" ${strings.project.singular}`}
                </Button>
              ))}
            <Button
              className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) aria-pressed:bg-(--hl-sm)"
              onPress={async () => {
                const { filePaths, canceled } = await window.dialog.showOpenDialog({
                  properties: ['openDirectory', 'createDirectory', 'promptToCreate'],
                  buttonLabel: 'Select',
                  title: 'Export All Insomnia Data',
                });

                if (canceled) {
                  return;
                }

                const [dirPath] = filePaths;

                try {
                  dirPath &&
                    (await exportAllData({
                      dirPath,
                    }));
                } catch (e) {
                  showModal(AlertModal, {
                    title: 'Export Failed',
                    message: 'An error occurred while exporting data. Please try again.',
                  });
                  console.error(e);
                }

                showModal(AlertModal, {
                  title: 'Export Complete',
                  message: 'All your data have been successfully exported',
                });
                window.main.trackSegmentEvent({
                  event: SegmentEvent.exportAllCollections,
                });
              }}
              aria-label="Export all data"
            >
              <Icon icon="file-export" />
              <span>Export all data {`(${workspaceCount - mcpWorkspaceCount} files)`}</span>
            </Button>

            <Button
              className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) aria-pressed:bg-(--hl-sm)"
              isDisabled={!userSession.id}
              onPress={() => window.main.openInBrowser('https://insomnia.rest/create-run-button')}
            >
              <i className="fa fa-file-import" />
              Create Run Button
            </Button>
          </div>
        </div>
        {showImportButtons && (
          <div className="flex flex-col gap-2 rounded-md border border-solid border-(--hl-md) p-4">
            <Heading className="flex items-center gap-2 text-lg font-bold">
              <Icon icon="file-import" /> Import
            </Heading>
            <div className="flex flex-wrap gap-2">
              {activeProject && (
                <Button
                  className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) aria-pressed:bg-(--hl-sm)"
                  isDisabled={workspaceData?.activeWorkspace && isScratchpad(workspaceData?.activeWorkspace)}
                  onPress={() => setIsImportModalOpen(true)}
                >
                  <Icon icon="file-import" />
                  {`Import to the "${projectName}" ${strings.project.singular}`}
                </Button>
              )}
              {features.bulkImport.enabled ? (
                <Button
                  className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) aria-pressed:bg-(--hl-sm)"
                  isDisabled={workspaceData?.activeWorkspace && isScratchpad(workspaceData?.activeWorkspace)}
                  onPress={() => setIsImportProjectsModalOpen(true)}
                >
                  <Icon icon="file-import" />
                  {`Import projects to the "${organizationName}" ${strings.organization.singular}`}
                </Button>
              ) : isEnterprisePlan ? (
                <p className="text-sm">
                  Need to import many projects at once? Reach out to{' '}
                  <a className="text-(--color-surprise)" href="mailto:support@insomnia.rest">
                    support@insomnia.rest
                  </a>{' '}
                  to have multi-project import enabled.
                </p>
              ) : null}
            </div>
          </div>
        )}
        {hasUntrackedProjects && (
          <div className="flex flex-col gap-2 rounded-md border border-solid border-(--hl-md) p-4">
            <div className="flex flex-col gap-1">
              <Heading className="flex items-center gap-2 text-lg font-bold">
                <Icon icon="cancel" /> Orphaned projects ({untrackedProjects.length})
              </Heading>
              <p className="text-sm text-(--hl)">
                <Icon icon="info-circle" /> These projects are not associated to your current logged-in account. You can
                move them to an organization below.
              </p>
            </div>
            <div className="flex flex-col gap-1 divide-y divide-solid divide-(--hl-md) overflow-y-auto">
              {untrackedProjects.map(project => (
                <UntrackedProject
                  key={project._id}
                  project={project}
                  organizationId={organizationId}
                  organizations={organizations}
                />
              ))}
            </div>
          </div>
        )}
        {hasUntrackedWorkspaces && projects.length > 0 && (
          <div className="flex flex-col gap-2 rounded-md border border-solid border-(--hl-md) p-4">
            <div className="flex flex-col gap-1">
              <Heading className="flex items-center gap-2 text-lg font-bold">
                <Icon icon="cancel" /> Untracked files ({untrackedWorkspaces.length})
              </Heading>
              <p className="text-sm text-(--hl)">
                <Icon icon="info-circle" /> These files are not associated with any project in your account. You can
                move them to a project in your current organization below.
              </p>
            </div>
            <div className="flex flex-col gap-1 divide-y divide-solid divide-(--hl-md) overflow-y-auto">
              {untrackedWorkspaces.map(workspace => (
                <UntrackedWorkspace
                  key={workspace._id}
                  workspace={workspace}
                  organizationId={organizationId}
                  projects={projects}
                />
              ))}
            </div>
          </div>
        )}
      </div>
      {isImportModalOpen && (
        <ImportModal
          onHide={() => setIsImportModalOpen(false)}
          from={{ type: 'file' }}
          projectName={projectName}
          workspaceName={activeWorkspaceName}
          organizationId={organizationId}
          defaultProjectId={projectId}
          defaultWorkspaceId={workspaceId}
        />
      )}
      {isImportProjectsModalOpen && (
        <ImportProjectsModal onHide={() => setIsImportProjectsModalOpen(false)} organizationId={organizationId} />
      )}
      {isExportModalOpen && workspaceData?.activeWorkspace && (
        <ExportRequestsModal
          workspaceIdToExport={workspaceData.activeWorkspace._id}
          onClose={() => setIsExportModalOpen(false)}
        />
      )}
    </Fragment>
  );
};

const ExportSection = ({
  workspace,
  projectName,
  setIsExportModalOpen,
  handleExportProjectToFile,
}: {
  workspace: Workspace;
  projectName: string;
  setIsExportModalOpen: (value: boolean) => void;
  handleExportProjectToFile: () => void;
}) => {
  if (isScratchpad(workspace)) {
    return (
      <Button
        className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) aria-pressed:bg-(--hl-sm)"
        onPress={() => setIsExportModalOpen(true)}
      >
        Export the "{workspace.name}" {getWorkspaceLabel(workspace).singular}
      </Button>
    );
  }

  return (
    <>
      <Button
        className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) aria-pressed:bg-(--hl-sm)"
        onPress={() => setIsExportModalOpen(true)}
      >
        Export the "{workspace.name}" {getWorkspaceLabel(workspace).singular}
      </Button>
      <Button
        className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-inset focus:ring-(--hl-md) aria-pressed:bg-(--hl-sm)"
        onPress={handleExportProjectToFile}
      >
        Export the "{projectName}" ${strings.project.singular}
      </Button>
    </>
  );
};

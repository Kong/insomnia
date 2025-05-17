import React, { type FC, Fragment, useEffect, useState } from 'react';
import { Button, Heading, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router';
import { useRouteLoaderData } from 'react-router';

import { getProductName } from '../../../common/constants';
import { exportAllData, exportProjectToFile } from '../../../common/export';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { isNotNullOrUndefined } from '../../../common/misc';
import { strings } from '../../../common/strings';
import { isScratchpadOrganizationId, type Organization } from '../../../models/organization';
import type { Project } from '../../../models/project';
import { isScratchpad, type Workspace } from '../../../models/workspace';
import { SegmentEvent } from '../../analytics';
import { useOrganizationLoaderData } from '../../routes/organization';
import type { ListWorkspacesLoaderData } from '../../routes/project';
import { useRootLoaderData } from '../../routes/root';
import type { UntrackedProjectsLoaderData } from '../../routes/untracked-projects';
import type { WorkspaceLoaderData } from '../../routes/workspace';
import { Icon } from '../icon';
import { showAlert } from '../modals';
import { ExportRequestsModal } from '../modals/export-requests-modal';
import { ImportModal } from '../modals/import-modal';

const UntrackedProject = ({
  project,
  organizationId,
  organizations,
}: {
  project: Project & { workspacesCount: number };
  organizationId: string;
  organizations: Organization[];
}) => {
  const moveProjectFetcher = useFetcher();
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<string | null>(null);

  return (
    <div key={project._id} className="flex items-center justify-between gap-2 py-2">
      <div className="flex flex-col gap-1">
        <Heading className="flex items-center gap-2 text-base font-semibold">
          {project.name}
          <span className="text-xs text-[--hl]">Id: {project._id}</span>
        </Heading>
        <p className="text-sm">
          This project contains {project.workspacesCount} {project.workspacesCount === 1 ? 'file' : 'files'}.
        </p>
      </div>
      <moveProjectFetcher.Form
        action={`/organization/${organizationId}/project/${project._id}/move`}
        method="POST"
        className="group flex items-center gap-2"
      >
        <Select
          aria-label="Select an organization"
          name="organizationId"
          onSelectionChange={key => {
            setSelectedOrganizationId(key.toString());
          }}
          selectedKey={selectedOrganizationId}
          isDisabled={organizations.length === 0}
        >
          <Button className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] disabled:cursor-not-allowed disabled:bg-[--hl-xs] aria-pressed:bg-[--hl-sm] data-[pressed]:bg-[--hl-xs]">
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
              className="min-w-max select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] py-2 text-sm shadow-lg focus:outline-none"
            >
              {item => (
                <ListBoxItem
                  id={item.id}
                  key={item.id}
                  className="text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-selected:font-bold"
                  aria-label={item.name}
                  textValue={item.name}
                  value={item}
                >
                  {({ isSelected }) => (
                    <Fragment>
                      {item.display_name}
                      {isSelected && <Icon icon="check" className="justify-self-end text-[--color-success]" />}
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
          className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] disabled:cursor-not-allowed disabled:bg-[--hl-xs] group-invalid:opacity-30 aria-pressed:bg-[--hl-sm]"
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
  const moveWorkspaceFetcher = useFetcher();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  return (
    <div key={workspace._id} className="flex items-center justify-between gap-2 py-2">
      <div className="flex flex-col gap-1">
        <Heading className="flex items-center gap-2 text-base font-semibold">
          {workspace.name}
          <span className="text-xs text-[--hl]">Id: {workspace._id}</span>
        </Heading>
      </div>
      <moveWorkspaceFetcher.Form
        action={`/organization/${organizationId}/project/${selectedProjectId}/move-workspace`}
        method="POST"
        className="group flex items-center gap-2"
      >
        <input type="hidden" name="workspaceId" value={workspace._id} />
        <Select
          aria-label="Select a project"
          name="projectId"
          onSelectionChange={key => {
            setSelectedProjectId(key.toString());
          }}
          selectedKey={selectedProjectId}
          isDisabled={projects.length === 0}
        >
          <Button className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] disabled:cursor-not-allowed disabled:bg-[--hl-xs] aria-pressed:bg-[--hl-sm] data-[pressed]:bg-[--hl-xs]">
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
              className="min-w-max select-none overflow-y-auto rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] py-2 text-sm shadow-lg focus:outline-none"
              items={projects.map(project => ({
                ...project,
                id: project._id,
              }))}
            >
              {item => (
                <ListBoxItem
                  id={item.id}
                  key={item.id}
                  className="text-md flex h-[--line-height-xs] w-full items-center gap-2 whitespace-nowrap bg-transparent px-[--padding-md] text-[--color-font] transition-colors hover:bg-[--hl-sm] focus:bg-[--hl-xs] focus:outline-none disabled:cursor-not-allowed aria-selected:font-bold"
                  aria-label={item.name}
                  textValue={item.name}
                  value={item}
                >
                  {({ isSelected }) => (
                    <Fragment>
                      {item.name}
                      {isSelected && <Icon icon="check" className="justify-self-end text-[--color-success]" />}
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
          className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] disabled:cursor-not-allowed disabled:bg-[--hl-xs] group-invalid:opacity-30 aria-pressed:bg-[--hl-sm]"
        >
          Move
        </Button>
      </moveWorkspaceFetcher.Form>
    </div>
  );
};

interface Props {
  hideSettingsModal: () => void;
}

export const ImportExport: FC<Props> = ({ hideSettingsModal }) => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId?: string;
  };
  const organizationData = useOrganizationLoaderData();
  const organizations = organizationData?.organizations || [];

  const untrackedProjectsFetcher = useFetcher<UntrackedProjectsLoaderData>();

  useEffect(() => {
    const isIdleAndUninitialized = untrackedProjectsFetcher.state === 'idle' && !untrackedProjectsFetcher.data;
    if (isIdleAndUninitialized) {
      untrackedProjectsFetcher.load('/untracked-projects');
    }
  }, [untrackedProjectsFetcher, organizationId]);

  const untrackedProjects = untrackedProjectsFetcher.data?.untrackedProjects || [];
  const untrackedWorkspaces = untrackedProjectsFetcher.data?.untrackedWorkspaces || [];

  const workspaceData = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData | undefined;
  const activeWorkspaceName = workspaceData?.activeWorkspace.name;
  const { workspaceCount, userSession } = useRootLoaderData();
  const workspacesFetcher = useFetcher<ListWorkspacesLoaderData>();
  useEffect(() => {
    const isIdleAndUninitialized = workspacesFetcher.state === 'idle' && !workspacesFetcher.data;
    if (isIdleAndUninitialized && organizationId && projectId && !isScratchpadOrganizationId(organizationId)) {
      workspacesFetcher.load(`/organization/${organizationId}/project/${projectId}/list-workspaces`);
    }
  }, [organizationId, projectId, workspacesFetcher]);
  const projectLoaderData = workspacesFetcher?.data;
  const workspacesForActiveProject = projectLoaderData?.files.map(w => w.workspace).filter(isNotNullOrUndefined) || [];
  const projectName = projectLoaderData?.activeProject?.name ?? getProductName();
  const projects = projectLoaderData?.projects || [];

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const handleExportProjectToFile = () => {
    exportProjectToFile(projectName, workspacesForActiveProject);
    hideSettingsModal();
  };
  const isLoggedIn = userSession.id || organizationId || projectLoaderData?.activeProject;
  const isScratchPadWorkspace = isScratchpad(workspaceData?.activeWorkspace);
  const hasUntrackedWorkspaces = untrackedWorkspaces.length > 0;
  const hasUntrackedProjects = untrackedProjects.length > 0;
  const showImportToProject = !isScratchPadWorkspace;
  if (!isScratchPadWorkspace && !isLoggedIn) {
    return (
      <Button
        className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
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
            showAlert({
              title: 'Export Failed',
              message: 'An error occurred while exporting data. Please try again.',
            });
            console.error(e);
          }

          showAlert({
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
        <span>Export all data {`(${workspaceCount} files)`}</span>
      </Button>
    );
  }

  return (
    <Fragment>
      <div data-testid="import-export-tab" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 rounded-md border border-solid border-[--hl-md] p-4">
          <Heading className="flex items-center gap-2 text-lg font-bold">
            <Icon icon="file-export" /> Export
          </Heading>
          <div className="flex flex-wrap gap-2">
            {workspaceData?.activeWorkspace ? (
              <ExportSection
                workspace={workspaceData.activeWorkspace}
                projectName={projectName}
                setIsExportModalOpen={setIsExportModalOpen}
                handleExportProjectToFile={handleExportProjectToFile}
              />
            ) : (
              <Button
                className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                onPress={handleExportProjectToFile}
              >
                {`Export files from the "${projectName}" ${strings.project.singular}`}
              </Button>
            )}
            <Button
              className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
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
                  showAlert({
                    title: 'Export Failed',
                    message: 'An error occurred while exporting data. Please try again.',
                  });
                  console.error(e);
                }

                showAlert({
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
              <span>Export all data {`(${workspaceCount} files)`}</span>
            </Button>

            <Button
              className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
              isDisabled={!userSession.id}
              onPress={() => window.main.openInBrowser('https://insomnia.rest/create-run-button')}
            >
              <i className="fa fa-file-import" />
              Create Run Button
            </Button>
          </div>
        </div>
        {showImportToProject && (
          <div className="flex flex-col gap-2 rounded-md border border-solid border-[--hl-md] p-4">
            <Heading className="flex items-center gap-2 text-lg font-bold">
              <Icon icon="file-import" /> Import
            </Heading>
            <div className="flex flex-wrap gap-2">
              <Button
                className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
                isDisabled={workspaceData?.activeWorkspace && isScratchpad(workspaceData?.activeWorkspace)}
                onPress={() => setIsImportModalOpen(true)}
              >
                <Icon icon="file-import" />
                {`Import to the "${projectName}" ${strings.project.singular}`}
              </Button>
            </div>
          </div>
        )}
        {hasUntrackedProjects && (
          <div className="flex flex-col gap-2 rounded-md border border-solid border-[--hl-md] p-4">
            <div className="flex flex-col gap-1">
              <Heading className="flex items-center gap-2 text-lg font-bold">
                <Icon icon="cancel" /> Orphaned projects ({untrackedProjects.length})
              </Heading>
              <p className="text-sm text-[--hl]">
                <Icon icon="info-circle" /> These projects are not associated to your current logged-in account. You can
                move them to an organization below.
              </p>
            </div>
            <div className="flex flex-col gap-1 divide-y divide-solid divide-[--hl-md] overflow-y-auto">
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
          <div className="flex flex-col gap-2 rounded-md border border-solid border-[--hl-md] p-4">
            <div className="flex flex-col gap-1">
              <Heading className="flex items-center gap-2 text-lg font-bold">
                <Icon icon="cancel" /> Untracked files ({untrackedWorkspaces.length})
              </Heading>
              <p className="text-sm text-[--hl]">
                <Icon icon="info-circle" /> These files are not associated with any project in your account. You can
                move them to a project in your current organization bellow.
              </p>
            </div>
            <div className="flex flex-col gap-1 divide-y divide-solid divide-[--hl-md] overflow-y-auto">
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
        className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
        onPress={() => setIsExportModalOpen(true)}
      >
        Export the "{workspace.name}" {getWorkspaceLabel(workspace).singular}
      </Button>
    );
  }

  return (
    <>
      <Button
        className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
        onPress={() => setIsExportModalOpen(true)}
      >
        Export the "{workspace.name}" {getWorkspaceLabel(workspace).singular}
      </Button>
      <Button
        className="flex items-center justify-center gap-2 rounded-sm border border-solid border-[--hl-md] px-4 py-1 text-sm font-semibold text-[--color-font] ring-1 ring-transparent transition-all hover:bg-[--hl-xs] focus:ring-inset focus:ring-[--hl-md] aria-pressed:bg-[--hl-sm]"
        onPress={handleExportProjectToFile}
      >
        Export the "{projectName}" ${strings.project.singular}
      </Button>
    </>
  );
};

import React, { type FC, Fragment, useEffect, useState } from 'react';
import { Button, Heading, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';
import { useRouteLoaderData } from 'react-router-dom';

import { getProductName } from '../../../common/constants';
import { exportProjectToFile } from '../../../common/export';
import { exportAllData } from '../../../common/export-all-data';
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
    <div key={project._id} className="flex items-center gap-2 justify-between py-2">
      <div className='flex flex-col gap-1'>
        <Heading className='text-base font-semibold flex items-center gap-2'>
          {project.name}
          <span className='text-xs text-[--hl]'>
            Id: {project._id}
          </span>
        </Heading>
        <p className='text-sm'>
          This project contains {project.workspacesCount} {project.workspacesCount === 1 ? 'file' : 'files'}.
        </p>
      </div>
      <moveProjectFetcher.Form
        action={`/organization/${organizationId}/project/${project._id}/move`}
        method='POST'
        className='group flex items-center gap-2'
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
          <Button className="px-4 py-1 disabled:bg-[--hl-xs] disabled:cursor-not-allowed font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] data-[pressed]:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
            <SelectValue<Organization> className="flex truncate items-center justify-center gap-2">
              {({ selectedItem }) => {
                if (!selectedItem) {
                  return (
                    <Fragment>
                      <span>
                        Select an organization
                      </span>
                    </Fragment>
                  );
                }

                return (
                  <Fragment>
                    {selectedItem.display_name}
                  </Fragment>
                );
              }}
            </SelectValue>
            <Icon icon="caret-down" />
          </Button>
          <Popover className="min-w-max overflow-y-hidden flex flex-col">
            <ListBox
              items={organizations}
              className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto focus:outline-none"
            >
              {item => (
                <ListBoxItem
                  id={item.id}
                  key={item.id}
                  className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                  aria-label={item.name}
                  textValue={item.name}
                  value={item}
                >
                  {({ isSelected }) => (
                    <Fragment>
                      {item.display_name}
                      {isSelected && (
                        <Icon
                          icon="check"
                          className="text-[--color-success] justify-self-end"
                        />
                      )}
                    </Fragment>
                  )}
                </ListBoxItem>
              )}
            </ListBox>
          </Popover>
        </Select>
        <Button isDisabled={organizations.length === 0 || !selectedOrganizationId || moveProjectFetcher.state !== 'idle'} type="submit" className="px-4 py-1 group-invalid:opacity-30 disabled:bg-[--hl-xs] disabled:cursor-not-allowed font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
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
    <div key={workspace._id} className="flex items-center gap-2 justify-between py-2">
      <div className='flex flex-col gap-1'>
        <Heading className='text-base font-semibold flex items-center gap-2'>
          {workspace.name}
          <span className='text-xs text-[--hl]'>
            Id: {workspace._id}
          </span>
        </Heading>
      </div>
      <moveWorkspaceFetcher.Form
        action={`/organization/${organizationId}/project/${selectedProjectId}/move-workspace`}
        method='POST'
        className='group flex items-center gap-2'
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
          <Button className="px-4 py-1 disabled:bg-[--hl-xs] disabled:cursor-not-allowed font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] data-[pressed]:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
            <SelectValue<Project> className="flex truncate items-center justify-center gap-2">
              {({ selectedItem }) => {
                if (!selectedItem) {
                  return (
                    <Fragment>
                      <span>
                        Select a project
                      </span>
                    </Fragment>
                  );
                }

                return (
                  <Fragment>
                    {selectedItem.name}
                  </Fragment>
                );
              }}
            </SelectValue>
            <Icon icon="caret-down" />
          </Button>
          <Popover className="min-w-max overflow-y-hidden flex flex-col">
            <ListBox
              className="border select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] py-2 rounded-md overflow-y-auto focus:outline-none"
              items={projects.map(project => ({
                ...project,
                id: project._id,
              }))}
            >
              {item => (
                <ListBoxItem
                  id={item.id}
                  key={item.id}
                  className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors"
                  aria-label={item.name}
                  textValue={item.name}
                  value={item}
                >
                  {({ isSelected }) => (
                    <Fragment>
                      {item.name}
                      {isSelected && (
                        <Icon
                          icon="check"
                          className="text-[--color-success] justify-self-end"
                        />
                      )}
                    </Fragment>
                  )}
                </ListBoxItem>
              )}
            </ListBox>
          </Popover>
        </Select>
        <Button isDisabled={projects.length === 0 || !selectedProjectId || moveWorkspaceFetcher.state !== 'idle'} type="submit" className="px-4 py-1 group-invalid:opacity-30 disabled:bg-[--hl-xs] disabled:cursor-not-allowed font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
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
  const {
    organizationId,
    projectId,
    workspaceId,
  } = useParams() as { organizationId: string; projectId: string; workspaceId?: string };
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
    return <Button
      className="px-4 py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
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
          dirPath && await exportAllData({
            dirPath,
          });
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
      aria-label='Export all data'
    >
      <Icon icon="file-export" />
      <span>Export all data {`(${workspaceCount} files)`}</span>
    </Button>;
  }

  return (
    <Fragment>
      <div data-testid="import-export-tab" className='flex flex-col gap-4'>
        <div className='rounded-md border border-solid border-[--hl-md] p-4 flex flex-col gap-2'>
          <Heading className='text-lg font-bold flex items-center gap-2'><Icon icon="file-export" /> Export</Heading>
          <div className="flex gap-2 flex-wrap">
            {workspaceData?.activeWorkspace ? (
              <ExportSection
                workspace={workspaceData.activeWorkspace}
                projectName={projectName}
                setIsExportModalOpen={setIsExportModalOpen}
                handleExportProjectToFile={handleExportProjectToFile}
              />) : (
              <Button
                className="px-4 py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                onPress={handleExportProjectToFile}
              >
                {`Export files from the "${projectName}" ${strings.project.singular}`}
              </Button>)}
            <Button
              className="px-4 py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
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
                  dirPath && await exportAllData({
                    dirPath,
                  });
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
              aria-label='Export all data'
            >
              <Icon icon="file-export" />
              <span>Export all data {`(${workspaceCount} files)`}</span>
            </Button>

            <Button
              className="px-4 py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
              isDisabled={!userSession.id}
              onPress={() => window.main.openInBrowser('https://insomnia.rest/create-run-button')}
            >
              <i className="fa fa-file-import" />
              Create Run Button
            </Button>
          </div>
        </div>
        {showImportToProject && <div className='rounded-md border border-solid border-[--hl-md] p-4 flex flex-col gap-2'>
          <Heading className='text-lg font-bold flex items-center gap-2'><Icon icon="file-import" /> Import</Heading>
          <div className="flex gap-2 flex-wrap">
            <Button
              className="px-4 py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
              isDisabled={workspaceData?.activeWorkspace && isScratchpad(workspaceData?.activeWorkspace)}
              onPress={() => setIsImportModalOpen(true)}
            >
              <Icon icon="file-import" />
              {`Import to the "${projectName}" ${strings.project.singular}`}
            </Button>
          </div>
        </div>}
        {hasUntrackedProjects && <div className='rounded-md border border-solid border-[--hl-md] p-4 flex flex-col gap-2'>
          <div className='flex flex-col gap-1'>
            <Heading className='text-lg font-bold flex items-center gap-2'><Icon icon="cancel" /> Orphaned projects ({untrackedProjects.length})</Heading>
            <p className='text-[--hl] text-sm'>
              <Icon icon="info-circle" /> These projects are not associated to your current logged-in account. You can move them to an organization below.
            </p>
          </div>
          <div className='flex flex-col gap-1 overflow-y-auto divide-y divide-solid divide-[--hl-md]'>
            {untrackedProjects.map(project => (
              <UntrackedProject
                key={project._id}
                project={project}
                organizationId={organizationId}
                organizations={organizations}
              />
            ))}
          </div>
        </div>}
        {hasUntrackedWorkspaces && projects.length > 0 && <div className='rounded-md border border-solid border-[--hl-md] p-4 flex flex-col gap-2'>
          <div className='flex flex-col gap-1'>
            <Heading className='text-lg font-bold flex items-center gap-2'><Icon icon="cancel" /> Untracked files ({untrackedWorkspaces.length})</Heading>
            <p className='text-[--hl] text-sm'>
              <Icon icon="info-circle" /> These files are not associated with any project in your account. You can move them to a project in your current organization bellow.
            </p>
          </div>
          <div className='flex flex-col gap-1 overflow-y-auto divide-y divide-solid divide-[--hl-md]'>
            {untrackedWorkspaces.map(workspace => (
              <UntrackedWorkspace
                key={workspace._id}
                workspace={workspace}
                organizationId={organizationId}
                projects={projects}
              />
            ))}
          </div>
        </div>}
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
        className="px-4 py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
        onPress={() => setIsExportModalOpen(true)}
      >
        Export the "{workspace.name}" {getWorkspaceLabel(workspace).singular}
      </Button>
    );
  }

  return (
    <>
      <Button
        className="px-4 py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
        onPress={() => setIsExportModalOpen(true)}
      >
        Export the "{workspace.name}" {getWorkspaceLabel(workspace).singular}
      </Button>
      <Button
        className="px-4 py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
        onPress={handleExportProjectToFile}
      >
        Export the "{projectName}" ${strings.project.singular}
      </Button>
    </>
  );

};

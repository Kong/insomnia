import React, { FC, Fragment, useEffect, useState } from 'react';
import { useFetcher, useParams } from 'react-router-dom';
import { useRouteLoaderData } from 'react-router-dom';

import { isLoggedIn } from '../../../account/session';
import { getProductName } from '../../../common/constants';
import { docsImportExport } from '../../../common/documentation';
import { exportAllToFile } from '../../../common/export';
import { exportAllData } from '../../../common/export-all-data';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { strings } from '../../../common/strings';
import { isScratchpadOrganizationId } from '../../../models/organization';
import { isScratchpad } from '../../../models/workspace';
import { SegmentEvent } from '../../analytics';
import { ProjectLoaderData } from '../../routes/project';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { Link } from '../base/link';
import { Icon } from '../icon';
import { showAlert } from '../modals';
import { ExportRequestsModal } from '../modals/export-requests-modal';
import { ImportModal } from '../modals/import-modal';
import { Button } from '../themed-button';
interface Props {
  hideSettingsModal: () => void;
}

export const ImportExport: FC<Props> = ({ hideSettingsModal }) => {
  const {
    organizationId,
    projectId,
    workspaceId,
  } = useParams() as { organizationId: string; projectId: string; workspaceId?: string };

  const workspaceData = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData | undefined;
  const activeWorkspaceName = workspaceData?.activeWorkspace.name;
  const projectName = workspaceData?.activeProject.name ?? getProductName();

  const workspacesFetcher = useFetcher();
  useEffect(() => {
    const isIdleAndUninitialized = workspacesFetcher.state === 'idle' && !workspacesFetcher.data;
    if (isIdleAndUninitialized && organizationId && !isScratchpadOrganizationId(organizationId)) {
      workspacesFetcher.load(`/organization/${organizationId}/project/${projectId}`);
    }
  }, [organizationId, projectId, workspacesFetcher]);
  const projectLoaderData = workspacesFetcher?.data as ProjectLoaderData;
  const workspacesForActiveProject = projectLoaderData?.workspaces.map(w => w.workspace) || [];
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const handleExportAllToFile = () => {
    exportAllToFile(projectName, workspacesForActiveProject);
    hideSettingsModal();
  };

  if (!organizationId) {
    return null;
  }
 // here we should list all the folders which contain insomnia.*.db files
 // and have some big red button to overwrite the current data with the backup
 // and once complete trigger an app restart?
  return (
    <Fragment>
      <div data-testid="import-export-tab">
        <div className="no-margin-top">
          Import format will be automatically detected.
        </div>
        <p>
          Your format isn't supported? <Link href={docsImportExport}>Add Your Own</Link>.
        </p>
        <div className="flex flex-col pt-4 gap-4">
          {workspaceData?.activeWorkspace ?
            isScratchpad(workspaceData.activeWorkspace) ?
              <Button onClick={() => setIsExportModalOpen(true)}>Export the "{activeWorkspaceName}" {getWorkspaceLabel(workspaceData.activeWorkspace).singular}</Button>
              :
            (<Dropdown
              aria-label='Export Data Dropdown'
              triggerButton={
                <DropdownButton className="btn btn--clicky">
                  Export Data <i className="fa fa-caret-down" />
                </DropdownButton>
              }
            >
              <DropdownSection
                aria-label="Choose Export Type"
                title="Choose Export Type"
              >
                <DropdownItem aria-label={`Export the "${activeWorkspaceName}" ${getWorkspaceLabel(workspaceData.activeWorkspace).singular}`}>
                  <ItemContent
                    icon="home"
                    label={`Export the "${activeWorkspaceName}" ${getWorkspaceLabel(workspaceData.activeWorkspace).singular}`}
                    onClick={() => setIsExportModalOpen(true)}
                  />
                </DropdownItem>
                <DropdownItem aria-label={`Export files from the "${projectName}" ${strings.project.singular}`}>
                  <ItemContent
                    icon="empty"
                    label={`Export files from the "${projectName}" ${strings.project.singular}`}
                    onClick={handleExportAllToFile}
                  />
                </DropdownItem>
              </DropdownSection>
            </Dropdown>) : (<Button onClick={handleExportAllToFile}>{`Export files from the "${projectName}" ${strings.project.singular}`}</Button>)
          }
          <Button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--padding-sm)',
            }}
            onClick={async () => {
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
            className="px-4 py-1 font-semibold border border-solid border-[--hl-md] flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-base"
          >
            <Icon icon="file-export" />
            <span>Export all data</span>
          </Button>
          <Button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--padding-sm)',
            }}
            disabled={workspaceData?.activeWorkspace && isScratchpad(workspaceData?.activeWorkspace)}
            onClick={() => setIsImportModalOpen(true)}
          >
            <i className="fa fa-file-import" />
            {`Import to the "${projectName}" ${strings.project.singular}`}
          </Button>

          <Button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--padding-sm)',
            }}
            disabled={!isLoggedIn()}
            onClick={() => window.main.openInBrowser('https://insomnia.rest/create-run-button')}
          >
            <i className="fa fa-file-import" />
            Create Run Button
          </Button>
        </div>
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
          workspace={workspaceData.activeWorkspace}
          onHide={() => setIsExportModalOpen(false)}
        />
      )}
    </Fragment>
  );
};

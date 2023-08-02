import React, { FC, Fragment, useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import { useRouteLoaderData } from 'react-router-dom';

import { isLoggedIn } from '../../../account/session';
import { getProductName } from '../../../common/constants';
import { docsImportExport } from '../../../common/documentation';
import { exportAllToFile } from '../../../common/export';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { strings } from '../../../common/strings';
import { isRequestGroup } from '../../../models/request-group';
import { isScratchpad } from '../../../models/workspace';
import { selectWorkspaceRequestsAndRequestGroups, selectWorkspacesForActiveProject } from '../../redux/selectors';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { Link } from '../base/link';
import { AlertModal } from '../modals/alert-modal';
import { ExportRequestsModal } from '../modals/export-requests-modal';
import { ImportModal } from '../modals/import-modal';
import { showModal } from '../modals/index';
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

  const workspacesForActiveProject = useSelector(selectWorkspacesForActiveProject);
  const workspaceRequestsAndRequestGroups = useSelector(selectWorkspaceRequestsAndRequestGroups);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const showExportRequestsModal = useCallback(() => {
    if (!workspaceRequestsAndRequestGroups.filter(r => !isRequestGroup(r)).length) {
      showModal(AlertModal, {
        title: 'Cannot export',
        message: <>There are no requests to export.</>,
      });
      return;
    }
    showModal(ExportRequestsModal);
    hideSettingsModal();
  }, [hideSettingsModal, workspaceRequestsAndRequestGroups]);

  const handleExportAllToFile = useCallback(() => {
    exportAllToFile(projectName, workspacesForActiveProject);
    hideSettingsModal();
  }, [hideSettingsModal, projectName, workspacesForActiveProject]);

  return (
    <Fragment>
      <div data-testid="import-export-tab">
        <div className="no-margin-top">
          Import format will be automatically detected.
        </div>
        <p>
          Your format isn't supported? <Link href={docsImportExport}>Add Your Own</Link>.
        </p>
        <div className="flex pt-4 gap-4">
          {workspaceData?.activeWorkspace ?
            isScratchpad(workspaceData.activeWorkspace) ?
              <Button onClick={showExportRequestsModal}>Export the "{activeWorkspaceName}" {getWorkspaceLabel(workspaceData.activeWorkspace).singular}</Button>
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
                    onClick={showExportRequestsModal}
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

          {workspaceData?.activeWorkspace && isScratchpad(workspaceData?.activeWorkspace) ? null : <Button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--padding-sm)',
            }}
            onClick={() => setIsImportModalOpen(true)}
          >
            <i className="fa fa-file-import" />
            {`Import to the "${projectName}" ${strings.project.singular}`}
          </Button>}

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
        <p className="italic faint">* Tip: You can also paste Curl commands into the URL bar</p>
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
    </Fragment>
  );
};

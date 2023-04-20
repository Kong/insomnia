import React, { FC, Fragment, useCallback, useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';

import { getProductName } from '../../../common/constants';
import { docsImportExport } from '../../../common/documentation';
import { exportAllToFile } from '../../../common/export';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { strings } from '../../../common/strings';
import { isRequestGroup } from '../../../models/request-group';
import { importers } from '../../../utils/importers/importers';
import { selectActiveProjectName, selectActiveWorkspace, selectActiveWorkspaceName, selectWorkspaceRequestsAndRequestGroups, selectWorkspacesForActiveProject } from '../../redux/selectors';
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
  } = useParams() as { organizationId: string; projectId: string; workspaceId: string };
  const projectName = useSelector(selectActiveProjectName) ?? getProductName();
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const activeWorkspaceName = useSelector(selectActiveWorkspaceName);
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
          Import format will be automatically detected. Supported formats include: {importers.map(importer => importer.name).join(', ')}
        </div>
        <p>
          Your format isn't supported? <Link href={docsImportExport}>Add Your Own</Link>.
        </p>
        <div className="pad-top">
          {activeWorkspace ?
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
                <DropdownItem aria-label={`Export the "${activeWorkspaceName}" ${getWorkspaceLabel(activeWorkspace).singular}`}>
                  <ItemContent
                    icon="home"
                    label={`Export the "${activeWorkspaceName}" ${getWorkspaceLabel(activeWorkspace).singular}`}
                    onClick={showExportRequestsModal}
                  />
                </DropdownItem>
                <DropdownItem aria-label={`All ${strings.document.plural} and ${strings.collection.plural} from the "${projectName}" ${strings.project.singular}`}>
                  <ItemContent
                    icon="empty"
                    label={`All ${strings.document.plural} and ${strings.collection.plural} from the "${projectName}" ${strings.project.singular}`}
                    onClick={handleExportAllToFile}
                  />
                </DropdownItem>
              </DropdownSection>
            </Dropdown>) : (<Button onClick={handleExportAllToFile}>Export all</Button>)
          }
        &nbsp;&nbsp;
          <Button
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--padding-sm)',
            }}
            onClick={() => setIsImportModalOpen(true)}
          >
            <i className="fa fa-file-import" />
            Import
          </Button>
        &nbsp;&nbsp;
          <Link href="https://insomnia.rest/create-run-button" className="btn btn--compact" button>
            Create Run Button
          </Link>
        </div>
        <p className="italic faint">* Tip: You can also paste Curl commands into the URL bar</p>
      </div>
      {isImportModalOpen && (
        <ImportModal
          onHide={() => setIsImportModalOpen(false)}
          from={{ type: 'file' }}
          organizationId={organizationId}
          defaultProjectId={projectId}
          defaultWorkspaceId={workspaceId}
        />
      )}
    </Fragment>
  );
};

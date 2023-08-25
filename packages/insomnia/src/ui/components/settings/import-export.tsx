import React, { FC, Fragment, useEffect, useState } from 'react';
import { useFetcher, useParams } from 'react-router-dom';
import { useRouteLoaderData } from 'react-router-dom';

import { getProductName } from '../../../common/constants';
import { docsImportExport } from '../../../common/documentation';
import { exportAllToFile } from '../../../common/export';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { strings } from '../../../common/strings';
import { ProjectLoaderData } from '../../routes/project';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { Link } from '../base/link';
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
    if (isIdleAndUninitialized) {
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
        <div className="pad-top">
          {workspaceData?.activeWorkspace ?
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
            {`Import to the "${projectName}" ${strings.project.singular}`}
          </Button>
          &nbsp;&nbsp;
          <Link href="https://insomnia.rest/create-run-button" className="btn btn--compact" button>
            Create Run Button
          </Link>
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

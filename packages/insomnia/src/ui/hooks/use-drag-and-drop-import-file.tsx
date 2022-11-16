import React, { useEffect } from 'react';
import { useSelector } from 'react-redux';

import { showModal } from '../components/modals';
import { AlertModal } from '../components/modals/alert-modal';
import { importUri } from '../import';
import { selectActiveProject, selectActiveWorkspace, selectProjects, selectWorkspacesWithResolvedNameForActiveProject } from '../redux/selectors';

export const useDragAndDropImportFile = () => {
  const activeWorkspace = useSelector(selectActiveWorkspace);
  const activeProjectWorkspaces = useSelector(selectWorkspacesWithResolvedNameForActiveProject);
  const activeProject = useSelector(selectActiveProject);
  const projects = useSelector(selectProjects);

  // Global Drag and Drop for importing files
  useEffect(() => {
  // NOTE: This is required for "drop" event to trigger.
    document.addEventListener(
      'dragover',
      event => {
        event.preventDefault();
      },
      false,
    );
    document.addEventListener(
      'drop',
      async event => {
        event.preventDefault();
        if (!activeWorkspace) {
          return;
        }
        const files = event.dataTransfer?.files || [];
        if (files.length === 0) {
          console.log('[drag] Ignored drop event because no files present');
          return;
        }
        const file = files[0];
        if (!file?.path) {
          return;
        }
        await showModal(AlertModal, {
          title: 'Confirm Data Import',
          message: (
            <span>
              Import <code>{file.path}</code>?
            </span>
          ),
          addCancel: true,
        });
        importUri(`file://${file.path}`, {
          activeProjectWorkspaces,
          activeProject,
          projects,
          workspaceId: activeWorkspace?._id,
        });
      },
      false,
    );
  });
};

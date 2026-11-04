import { models, services } from 'insomnia-data';
import { useState } from 'react';

import { useRequestDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.delete';
import { useRequestGroupDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.delete';
import { showModal } from '~/ui/components/modals';
import { AskModal } from '~/ui/components/modals/ask-modal';
import { WorkspaceDeleteModal } from '~/ui/components/modals/workspace-delete-modal';

import { getRequestNameOrFallback } from './request-node';
import type { CollectionChildFlatItem, PinnedRequestFlatItem, ProjectFlatItem, WorkspaceFlatItem } from './types';

export type DeleteTargetItem = ProjectFlatItem | WorkspaceFlatItem | CollectionChildFlatItem | PinnedRequestFlatItem;

interface Options {
  onDeleteProject: (projectId: string) => void;
  onWorkspaceDeleted?: (workspaceId: string) => void;
}

// Returns a function to open the delete confirmation for projects, workspaces, request groups, and requests,
// plus the element that hosts the workspace confirmation, which must be rendered once by the caller.
export const useDeleteModal = ({ onDeleteProject, onWorkspaceDeleted }: Options) => {
  const deleteRequestFetcher = useRequestDeleteActionFetcher();
  const deleteRequestGroupFetcher = useRequestGroupDeleteActionFetcher();
  const [workspaceToDelete, setWorkspaceToDelete] = useState<WorkspaceFlatItem | null>(null);

  const showDeleteModal = (item: DeleteTargetItem) => {
    if (item.kind === 'project') {
      const { doc: project } = item;
      const projectName = project.name;
      const title = 'Delete Project';
      let message = `You are deleting the project "${projectName}" that may have collaborators. As a result of this, the project will be permanently deleted for every collaborator of the organization. Do you really want to continue?`;
      const yesText = 'Delete';

      if (models.project.isGitProject(project)) {
        message = `You are deleting the Git project "${projectName}". Deleting this project will not delete the remote repository but all your local changes will be lost. Do you really want to continue?`;
      }

      showModal(AskModal, {
        title,
        message,
        yesText,
        noText: 'Cancel',
        color: 'danger',
        onDone: async (isYes: boolean) => {
          if (isYes) {
            onDeleteProject(project._id);
          }
        },
      });
      return;
    }

    if (item.kind === 'workspace') {
      // The scratchpad can't be deleted
      
      setWorkspaceToDelete(item);
      return;
    }

    const { doc, organizationId, project, workspace } = item;
    if (models.requestGroup.isRequestGroup(doc)) {
      showModal(AskModal, {
        title: 'Delete Folder',
        message: `Do you really want to delete "${getRequestNameOrFallback(doc)}"?`,
        yesText: 'Delete',
        noText: 'Cancel',
        color: 'danger',
        onDone: async (isYes: boolean) => {
          if (isYes) {
            services.stats.incrementDeletedRequestsForDescendents(doc);
            deleteRequestGroupFetcher.submit({
              organizationId,
              projectId: project._id,
              workspaceId: workspace._id,
              id: doc._id,
            });
          }
        },
      });
      return;
    }

    showModal(AskModal, {
      title: 'Delete Request',
      message: `Do you really want to delete "${getRequestNameOrFallback(doc)}"?`,
      yesText: 'Delete',
      noText: 'Cancel',
      color: 'danger',
      onDone: async (isYes: boolean) => {
        if (isYes) {
          services.stats.incrementDeletedRequests();
          deleteRequestFetcher.submit({
            organizationId,
            projectId: project._id,
            workspaceId: workspace._id,
            id: doc._id,
          });
        }
      },
    });
  };

  const deleteModal = workspaceToDelete && (
    <WorkspaceDeleteModal
      workspace={workspaceToDelete.doc}
      project={workspaceToDelete.project}
      organizationId={workspaceToDelete.organizationId}
      onClose={() => setWorkspaceToDelete(null)}
      onDeleted={() => onWorkspaceDeleted?.(workspaceToDelete.doc._id)}
    />
  );

  return { showDeleteModal, deleteModal };
};

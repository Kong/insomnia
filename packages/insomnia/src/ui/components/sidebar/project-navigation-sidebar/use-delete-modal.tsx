import { models, services } from 'insomnia-data';
import { useEffect, useState } from 'react';

import { useRequestDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.delete';
import { useRequestGroupDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.delete';
import { showModal } from '~/ui/components/modals';
import { AskModal } from '~/ui/components/modals/ask-modal';
import { WorkspaceDeleteModal } from '~/ui/components/modals/workspace-delete-modal';

import { getRequestNameOrFallback } from './request-node';
import type {
  CollectionChildFlatItem,
  FlatItem,
  PinnedRequestFlatItem,
  ProjectFlatItem,
  WorkspaceFlatItem,
} from './types';

export type DeleteTargetItem = ProjectFlatItem | WorkspaceFlatItem | CollectionChildFlatItem | PinnedRequestFlatItem;

interface Options {
  // Unfiltered sidebar items, used to notice when the workspace being deleted is gone
  flatItems: FlatItem[];
  onDeleteProject: (projectId: string) => void;
  onWorkspaceDeleted?: (workspaceId: string) => void;
}

// Returns a function to open the delete confirmation for projects, workspaces, request groups, and requests,
// plus the element that hosts the workspace confirmation, which must be rendered once by the caller.
export const useDeleteModal = ({ flatItems, onDeleteProject, onWorkspaceDeleted }: Options) => {
  const deleteRequestFetcher = useRequestDeleteActionFetcher();
  const deleteRequestGroupFetcher = useRequestGroupDeleteActionFetcher();
  // Kept after closing so the modal can play its exit animation
  const [workspaceToDelete, setWorkspaceToDelete] = useState<WorkspaceFlatItem | null>(null);
  const [isWorkspaceModalOpen, setIsWorkspaceModalOpen] = useState(false);

  // The workspace disappearing from the sidebar is the signal that the deletion succeeded.
  // On failure (e.g. a remote error) it stays, so the modal remains open to show the error.
  const isWorkspaceGone =
    !!workspaceToDelete && !flatItems.some(i => i.kind === 'workspace' && i.doc._id === workspaceToDelete.doc._id);
  useEffect(() => {
    if (isWorkspaceModalOpen && isWorkspaceGone) {
      setIsWorkspaceModalOpen(false);
      onWorkspaceDeleted?.(workspaceToDelete.doc._id);
    }
  }, [isWorkspaceModalOpen, isWorkspaceGone, workspaceToDelete, onWorkspaceDeleted]);

  const showDeleteModal = (item: DeleteTargetItem) => {
    if (item.kind === 'project') {
      const { doc: project } = item;
      // The scratchpad can't be deleted
      if (project._id === models.project.SCRATCHPAD_PROJECT_ID) {
        return;
      }
      const projectName = project.name;
      let title = 'Delete Project';
      let message = `You are deleting the project "${projectName}" that may have collaborators. As a result of this, the project will be permanently deleted for every collaborator of the organization. Do you really want to continue?`;
      let yesText = 'Delete';

      if (project.konnectControlPlaneId) {
        title = 'Remove Project';
        message = `Do you wish to remove your local copy of the "${projectName}" project? This will not affect anything in Konnect, or any other users.`;
        yesText = 'Remove';
      } else if (models.project.isGitProject(project)) {
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
      if (models.workspace.isScratchpad(item.doc)) {
        return;
      }
      setWorkspaceToDelete(item);
      setIsWorkspaceModalOpen(true);
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
      key={workspaceToDelete.doc._id}
      isOpen={isWorkspaceModalOpen}
      workspace={workspaceToDelete.doc}
      project={workspaceToDelete.project}
      organizationId={workspaceToDelete.organizationId}
      onClose={() => setIsWorkspaceModalOpen(false)}
    />
  );

  return { showDeleteModal, deleteModal };
};

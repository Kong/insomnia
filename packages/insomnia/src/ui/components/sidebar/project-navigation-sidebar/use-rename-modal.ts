import { models } from 'insomnia-data';

import { getWorkspaceLabel } from '~/common/get-workspace-label';
import { useRequestUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId.update';
import { useRequestGroupUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId.update';
import { useWorkspaceUpdateActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.update';
import { showModal } from '~/ui/components/modals';
import { PromptModal } from '~/ui/components/modals/prompt-modal';

import { getRequestNameOrFallback } from './request-node';
import type { CollectionChildFlatItem, PinnedRequestFlatItem, WorkspaceFlatItem } from './types';

export type RenameTargetItem = WorkspaceFlatItem | CollectionChildFlatItem | PinnedRequestFlatItem;

// Returns a function to open rename modals for workspaces, request groups, and requests.
export const useRenameModal = () => {
  const updateWorkspaceFetcher = useWorkspaceUpdateActionFetcher();
  const updateRequestGroupFetcher = useRequestGroupUpdateActionFetcher();
  const updateRequestFetcher = useRequestUpdateActionFetcher();

  return (item: RenameTargetItem) => {
    if (item.kind === 'workspace') {
      const { doc, organizationId, project } = item;
      // The scratchpad can't be renamed
      if (models.workspace.isScratchpad(doc)) {
        return;
      }
      showModal(PromptModal, {
        title: `Rename ${getWorkspaceLabel(doc).singular}`,
        defaultValue: doc.name,
        submitName: 'Rename',
        selectText: true,
        label: 'Name',
        onComplete: name =>
          updateWorkspaceFetcher.submit({
            organizationId,
            projectId: project._id,
            patch: { name, workspaceId: doc._id },
          }),
      });
      return;
    }

    const { doc, organizationId, project, workspace } = item;
    const originalName = getRequestNameOrFallback(doc);
    showModal(PromptModal, {
      title: `Rename ${originalName}`,
      defaultValue: originalName,
      submitName: 'Rename',
      selectText: true,
      label: 'Name',
      onComplete: newName =>
        models.requestGroup.isRequestGroup(doc)
          ? updateRequestGroupFetcher.submit({
              organizationId,
              projectId: project._id,
              workspaceId: workspace._id,
              requestGroupId: doc._id,
              patch: { name: newName },
            })
          : updateRequestFetcher.submit({
              organizationId,
              projectId: project._id,
              workspaceId: workspace._id,
              requestId: doc._id,
              patch: { name: newName },
            }),
    });
  };
};

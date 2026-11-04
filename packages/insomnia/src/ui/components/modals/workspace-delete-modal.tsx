import type { Project, Workspace } from 'insomnia-data';
import { services } from 'insomnia-data';
import { useCallback, useEffect, useRef } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';
import { href } from 'react-router';

import { useWorkspaceDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.delete';

import type { ChangeBufferEvent } from '../../../common/database';
import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { Icon } from '../icon';

interface Props {
  workspace: Workspace;
  project: Project;
  organizationId: string;
  onClose: () => void;
  onDeleted?: () => void;
}

export const WorkspaceDeleteModal = ({ workspace, organizationId, onClose, onDeleted }: Props) => {
  const deleteWorkspaceFetcher = useWorkspaceDeleteActionFetcher();
  const workspaceId = workspace._id;
  const workspaceName = workspace.name;

  // The parent passes inline callbacks, so keep the latest ones in a ref to avoid resubscribing on every render
  const callbacks = useRef({ onClose, onDeleted });
  callbacks.current = { onClose, onDeleted };
  const hasFinished = useRef(false);
  const finish = useCallback(() => {
    if (hasFinished.current) {
      return;
    }
    hasFinished.current = true;
    callbacks.current.onDeleted?.();
    callbacks.current.onClose();
  }, []);

  // Close once the deletion succeeds (the action redirects, so no error data is returned)
  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (deleteWorkspaceFetcher.state !== 'idle') {
      wasSubmitting.current = true;
    } else if (wasSubmitting.current) {
      wasSubmitting.current = false;
      if (!deleteWorkspaceFetcher.data?.error) {
        finish();
      }
    }
  }, [deleteWorkspaceFetcher.state, deleteWorkspaceFetcher.data, finish]);

  // Fallback: the fetcher transition above can be missed when closing the workspace's tabs navigates away
  // while the action's redirect is in flight, so also close once the workspace is gone from the database.
  useEffect(
    () =>
      window.main.on('db.changes', async (_, changes: ChangeBufferEvent[]) => {
        const wasRemoved = changes.some(([type, doc]) => type === 'remove' && doc._id === workspaceId);
        if (wasRemoved && !(await services.workspace.getById(workspaceId))) {
          finish();
        }
      }),
    [workspaceId, finish],
  );

  return (
    <ModalOverlay
      isOpen
      onOpenChange={() => onClose()}
      isDismissable
      className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={() => onClose()}
        className="max-h-full w-full max-w-2xl rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)"
      >
        <Dialog className="outline-hidden">
          {({ close }) => (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2">
                <Heading className="text-2xl">
                  {'Delete'} {getWorkspaceLabel(workspace).singular}
                </Heading>
                <Button
                  className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <deleteWorkspaceFetcher.Form
                action={href(`/organization/:organizationId/project/:projectId/workspace/delete`, {
                  organizationId,
                  projectId: workspace.parentId,
                })}
                method="POST"
                className="flex flex-col gap-4"
              >
                <input type="hidden" name="workspaceId" value={workspaceId} />
                <div>
                  <p className="line-clamp-5">
                    {(
                      <>
                        This will permanently delete the{' '}
                        <strong className="break-all whitespace-pre-wrap">{workspaceName}</strong>{' '}
                        {getWorkspaceLabel(workspace).singular}
                      </>
                    )}
                  </p>
                  
                </div>
                {deleteWorkspaceFetcher.data?.error && (
                  <p className="notice error margin-bottom-sm no-margin-top">{deleteWorkspaceFetcher.data.error}</p>
                )}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    aria-label="Delete Workspace"
                    className="rounded-xs border border-solid border-(--hl-md) bg-(--color-danger) px-3 py-2 text-(--color-font-danger) transition-colors hover:bg-(--color-danger)/90 hover:no-underline"
                  >
                    {'Delete'}
                  </Button>
                </div>
              </deleteWorkspaceFetcher.Form>
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

import type { Project, Workspace } from 'insomnia-data';
import { models } from 'insomnia-data';
import { useEffect, useRef } from 'react';
import { Button, Dialog, Heading, Label, Modal, ModalOverlay, Radio, RadioGroup } from 'react-aria-components';
import { href } from 'react-router';

import { useWorkspaceDeleteActionFetcher } from '~/routes/organization.$organizationId.project.$projectId.workspace.delete';

import { getWorkspaceLabel } from '../../../common/get-workspace-label';
import { Icon } from '../icon';

interface Props {
  workspace: Workspace;
  project: Project;
  organizationId: string;
  onClose: () => void;
  onDeleted?: () => void;
}

export const WorkspaceDeleteModal = ({ workspace, project, organizationId, onClose, onDeleted }: Props) => {
  const deleteWorkspaceFetcher = useWorkspaceDeleteActionFetcher();
  const workspaceId = workspace._id;
  const workspaceName = workspace.name;

  // Close once the deletion succeeds (the action redirects, so no error data is returned)
  const wasSubmitting = useRef(false);
  useEffect(() => {
    if (deleteWorkspaceFetcher.state !== 'idle') {
      wasSubmitting.current = true;
    } else if (wasSubmitting.current) {
      wasSubmitting.current = false;
      if (!deleteWorkspaceFetcher.data?.error) {
        onDeleted?.();
        onClose();
      }
    }
  }, [deleteWorkspaceFetcher.state, deleteWorkspaceFetcher.data, onClose, onDeleted]);

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
                  {project.konnectControlPlaneId ? 'Remove' : 'Delete'} {getWorkspaceLabel(workspace).singular}
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
                    {project.konnectControlPlaneId ? (
                      <>
                        Do you wish to remove your local copy of the{' '}
                        <strong className="break-all whitespace-pre-wrap">{workspaceName}</strong>{' '}
                        {getWorkspaceLabel(workspace).singular}? This will not affect anything in Konnect, or any other
                        users.
                      </>
                    ) : (
                      <>
                        This will permanently delete the{' '}
                        <strong className="break-all whitespace-pre-wrap">{workspaceName}</strong>{' '}
                        {getWorkspaceLabel(workspace).singular}
                      </>
                    )}
                  </p>
                  {models.project.isRemoteProject(project) && (
                    <RadioGroup name="localOnly" defaultValue="true" className="mb-2 flex flex-col gap-2">
                      <Label className="text-sm text-(--hl)">How do you want to delete it?</Label>
                      <div className="flex gap-2">
                        <Radio
                          value="true"
                          aria-label="Remove Local Copy"
                          className="flex-1 rounded-sm border border-solid border-(--hl-md) p-4 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-disabled:opacity-25 data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
                        >
                          <div>
                            <Heading className="text-lg font-bold">Remove Local Copy</Heading>
                            <p className="pt-2">The project will still exist on the Cloud.</p>
                          </div>
                        </Radio>
                        <Radio
                          value="false"
                          aria-label="Delete Permanently"
                          className="flex-1 rounded-sm border border-solid border-(--hl-md) p-4 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-disabled:opacity-25 data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
                        >
                          <div>
                            <Heading className="text-lg font-bold">Delete Permanently</Heading>
                            <p className="pt-2">The project will be deleted everywhere. You cannot undo this action.</p>
                          </div>
                        </Radio>
                      </div>
                    </RadioGroup>
                  )}
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
                    {project.konnectControlPlaneId ? 'Remove' : 'Delete'}
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

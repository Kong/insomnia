import React from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';

import { Icon } from '../icon';
import { WorkspaceEnvironmentsEditor } from '../workspace-environments-editor';

export const WorkspaceEnvironmentsEditModal = ({
  onClose,
  // Environment preselected on open, e.g. when opened for a specific variable's
  // source. Validated against this workspace's environments — the id can go stale
  // (e.g. the environment is deleted between hover and Open) and an unknown id
  // would leave the modal with no editor and no selection.
  initialEnvironmentId,
  // Bumped by every "open variable source" request. The modal stays mounted while
  // open, so a request for the same environment must apply again instead of being
  // treated as an unchanged prop.
  selectionRequestId = 0,
}: {
  onClose: () => void;
  initialEnvironmentId?: string;
  selectionRequestId?: number;
}) => {
  return (
    <ModalOverlay
      isOpen
      onOpenChange={isOpen => {
        !isOpen && onClose();
      }}
      className="fixed top-0 left-0 z-10 flex h-(--visual-viewport-height) w-full items-center justify-center bg-black/30"
    >
      <Modal
        onOpenChange={isOpen => {
          !isOpen && onClose();
        }}
        className="flex h-[calc(100%-var(--padding-xl))] w-[calc(100%-var(--padding-xl))] flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-(--padding-lg) text-(--color-font)"
      >
        <Dialog className="flex h-full flex-1 flex-col overflow-hidden outline-hidden">
          {({ close }) => (
            <div className="flex h-full flex-1 flex-col gap-4 overflow-hidden">
              <div className="flex items-center justify-between gap-2">
                <Heading slot="title" className="text-2xl">
                  Manage Environments
                </Heading>
                <Button
                  className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>
              <WorkspaceEnvironmentsEditor
                initialEnvironmentId={initialEnvironmentId}
                selectionRequestId={selectionRequestId}
                footerAction={({ isSaving }) => (
                  <Button
                    onPress={close}
                    isDisabled={isSaving}
                    className="rounded-xs border border-solid border-(--hl-md) px-3 py-2 text-(--color-font) transition-colors hover:no-underline aria-disabled:opacity-50"
                  >
                    Close
                  </Button>
                )}
              />
            </div>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

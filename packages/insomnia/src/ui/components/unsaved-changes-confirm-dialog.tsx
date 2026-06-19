import React, { type RefObject, useLayoutEffect, useState } from 'react';
import { Button, Dialog, Heading, Modal, ModalOverlay } from 'react-aria-components';

interface Props {
  /** Whether the confirm dialog is visible. */
  isOpen: boolean;
  /** Called when the user confirms discarding their unsaved changes. */
  onConfirm: () => void;
  /** Called when the user backs out (Escape, the "No" button) to keep editing. */
  onDismiss: () => void;
  /**
   * When provided, the confirm dialog's backdrop is constrained to this element's
   * bounds so the dialog appears centered within it (e.g. a parent modal).
   * When omitted, the backdrop is centered relative to the full viewport.
   */
  parentRef?: RefObject<HTMLElement>;
}

/**
 * Presentational confirm dialog for "you have unsaved changes" flows. Stateless
 * and fully controlled — it only renders based on `isOpen` and reports the
 * user's choice via `onConfirm` (discard) / `onDismiss` (keep editing).
 *
 * Normally you don't render this directly: `UnsavedChangesGuard` owns the open
 * state and renders it for you. Reach for it only when you need custom placement.
 */
export const UnsavedChangesConfirmDialog = ({ isOpen, onConfirm, onDismiss, parentRef }: Props) => {
  const [overlayStyle, setOverlayStyle] = useState<React.CSSProperties>({});

  // Update the overlay style to match the parent element's position and size when the dialog opens
  useLayoutEffect(() => {
    if (!parentRef?.current || !isOpen) {
      setOverlayStyle({});
      return;
    }
    const rect = parentRef.current.getBoundingClientRect();
    setOverlayStyle({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
  }, [parentRef, isOpen]);

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={open => !open && onDismiss()}
      style={parentRef?.current ? overlayStyle : undefined}
      className={`fixed z-[200] flex items-center justify-center bg-black/10 ${parentRef?.current ? '' : 'top-0 left-0 h-(--visual-viewport-height) w-full'}`}
    >
      <Modal className="flex w-full max-w-sm flex-col rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) p-6 text-(--color-font) shadow-xl">
        <Dialog className="flex flex-col gap-4 outline-hidden" aria-describedby="unsaved-description">
          <Heading slot="title" className="text-lg font-semibold">
            Unsaved changes
          </Heading>
          <p id="unsaved-description" className="text-sm">
            You will lose any unsaved changes. Are you sure you want to cancel?
          </p>
          <div className="flex items-center justify-end gap-2">
            <Button
              autoFocus
              onPress={onDismiss}
              className="rounded-md border border-solid border-(--hl-md) px-3 py-2 text-sm text-(--color-font) transition-colors hover:bg-(--hl-xs)"
            >
              No
            </Button>
            <Button
              onPress={onConfirm}
              className="rounded-md border border-solid border-(--hl-md) bg-(--color-danger) px-3 py-2 text-sm text-(--color-font-danger) transition-colors hover:bg-(--color-danger)/90"
            >
              Yes
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

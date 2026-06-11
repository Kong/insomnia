import { useCallback, useState } from 'react';

/**
 * Gate logic for "you have unsaved changes" confirm-on-close flows.
 *
 * Route every close affordance through the returned `requestClose`: it closes
 * immediately when there are no changes, otherwise it opens a confirm dialog and
 * defers `onClose` until the user confirms.
 *
 * Most consumers should use `UnsavedChangesGuard`, which pairs this hook with
 * the dialog. Use this hook directly only when you need custom dialog placement;
 * spread `confirmDialogProps` onto `UnsavedChangesConfirmDialog`.
 *
 * @param hasUnsavedChanges Whether closing would discard unsaved changes.
 * @param onClose Invoked once the close is allowed (no changes, or confirmed).
 */
export function useUnsavedChangesGuard(hasUnsavedChanges: boolean, onClose: () => void) {
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  const requestClose = useCallback(() => {
    if (hasUnsavedChanges) {
      setIsConfirmDialogOpen(true);
      return;
    }
    onClose();
  }, [hasUnsavedChanges, onClose]);

  const confirmClose = useCallback(() => {
    setIsConfirmDialogOpen(false);
    onClose();
  }, [onClose]);

  const dismissClose = useCallback(() => setIsConfirmDialogOpen(false), []);

  return {
    requestClose,
    confirmDialogProps: {
      isOpen: isConfirmDialogOpen,
      onConfirm: confirmClose,
      onDismiss: dismissClose,
    },
  };
}

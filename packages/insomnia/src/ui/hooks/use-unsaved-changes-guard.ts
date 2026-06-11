import { useCallback, useState } from 'react';

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

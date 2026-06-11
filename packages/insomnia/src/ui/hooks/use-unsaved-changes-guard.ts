import { useCallback, useState } from 'react';

export function useUnsavedChangesGuard(isDirty: boolean, onClose: () => void) {
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);

  const requestClose = useCallback(() => {
    if (isDirty) {
      setIsConfirmDialogOpen(true);
      return;
    }
    onClose();
  }, [isDirty, onClose]);

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

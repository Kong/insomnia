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

  return {
    isConfirmDialogOpen,
    setIsConfirmDialogOpen,
    requestClose,
    confirmClose,
  };
}

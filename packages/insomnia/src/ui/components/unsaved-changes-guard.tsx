import type { ReactNode } from 'react';

import { useUnsavedChangesGuard } from '~/ui/hooks/use-unsaved-changes-guard';

import { UnsavedChangesConfirmDialog } from './unsaved-changes-confirm-dialog';

interface Props {
  /** Whether there are unsaved changes that should be confirmed before closing. */
  isDirty: boolean;
  /** Called once the close is allowed (no changes, or the user confirmed discarding them). */
  onClose: () => void;
  /**
   * Render content here. Wire every close affordance (X button, Cancel,
   * overlay dismiss) to the provided `requestClose` instead of closing directly —
   * it gates on `isDirty` and prompts the confirm dialog when needed.
   */
  children: (api: { requestClose: () => void }) => ReactNode;
}

/**
 * Drop-in guard for "you have unsaved changes" flows. Owns the confirm-dialog
 * state and renders the dialog itself, so consumers only need to render this
 * component and route their close actions through `requestClose`.
 */
export const UnsavedChangesGuard = ({ isDirty, onClose, children }: Props) => {
  const { requestClose, confirmDialogProps } = useUnsavedChangesGuard(isDirty, onClose);

  return (
    <>
      {children({ requestClose })}
      <UnsavedChangesConfirmDialog {...confirmDialogProps} />
    </>
  );
};

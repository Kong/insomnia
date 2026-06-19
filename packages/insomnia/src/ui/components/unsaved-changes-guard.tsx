import type { ReactNode, RefObject } from 'react';

import { useUnsavedChangesGuard } from '~/ui/hooks/use-unsaved-changes-guard';

import { UnsavedChangesConfirmDialog } from './unsaved-changes-confirm-dialog';

interface Props {
  /** Whether there are unsaved changes that should be confirmed before closing. */
  hasUnsavedChanges: boolean;
  /** Called once the close is allowed (no changes, or the user confirmed discarding them). */
  onClose: () => void;
  /**
   * When provided, the confirm dialog's backdrop is constrained to this element's
   * bounds so the dialog appears centered within it (e.g. a parent modal).
   * When omitted, the backdrop is centered relative to the full viewport.
   */
  parentRef?: RefObject<HTMLElement>;
  /**
   * Render content here. Wire every close affordance (X button, Cancel,
   * overlay dismiss) to the provided `requestClose` instead of closing directly —
   * it gates on `hasUnsavedChanges` and prompts the confirm dialog when needed.
   */
  children: (api: { requestClose: () => void }) => ReactNode;
}

/**
 * Drop-in guard for "you have unsaved changes" flows. Owns the confirm-dialog
 * state and renders the dialog itself, so consumers only need to render this
 * component and route their close actions through `requestClose`.
 */
export const UnsavedChangesGuard = ({ hasUnsavedChanges, onClose, parentRef, children }: Props) => {
  const { requestClose, confirmDialogProps } = useUnsavedChangesGuard(hasUnsavedChanges, onClose);

  return (
    <>
      {children({ requestClose })}
      <UnsavedChangesConfirmDialog {...confirmDialogProps} parentRef={parentRef} />
    </>
  );
};

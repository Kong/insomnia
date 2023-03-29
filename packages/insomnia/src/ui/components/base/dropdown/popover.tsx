import React, { FC, ReactNode, useRef } from 'react';
import { AriaPopoverProps, DismissButton, Overlay, useOverlayTrigger, usePopover } from 'react-aria';
import { OverlayTriggerState } from 'react-stately';

interface Props extends Omit<AriaPopoverProps, 'popoverRef' | 'maxHeight'> {
  children: ReactNode;
  state: OverlayTriggerState;
}

export const Popover: FC<Props> = (props: Props) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const { state, children, isNonModal } = props;

  const { overlayProps } = useOverlayTrigger(
    { type: 'dialog' },
    state,
    props.triggerRef
  );

  // Handle events that should cause the popup to close,
  // e.g. blur, clicking outside, or pressing the escape key.
  const { popoverProps } = usePopover({ ...{ ...props, ...overlayProps, offset: 4 }, popoverRef }, state);

  return (
    <Overlay>
      <div style={{ position: 'fixed', inset: 0 }} />
      <div {...popoverProps} ref={popoverRef}>
        {!isNonModal && <DismissButton onDismiss={state.close} />}
        {children}
        <DismissButton onDismiss={state.close} />
      </div>
    </Overlay>
  );
};

import { AriaPopoverProps, DismissButton, Overlay, usePopover } from '@react-aria/overlays';
import React, { ReactNode, useRef } from 'react';
import { FC } from 'react';
import { OverlayTriggerState } from 'react-stately';

interface Props extends Omit<AriaPopoverProps, 'popoverRef'> {
  children: ReactNode;
  state: OverlayTriggerState;
}

export const Popover: FC<Props> = (props: Props) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const { state, children, isNonModal } = props;

  // Handle events that should cause the popup to close,
  // e.g. blur, clicking outside, or pressing the escape key.
  const { popoverProps } = usePopover({ ...props, popoverRef }, state);

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

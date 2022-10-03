import classnames from 'classnames';
import React, {
  isValidElement,
  ReactNode,
} from 'react';
import {
  mergeProps,
  OverlayContainer,
  useOverlayPosition,
  useTooltip,
  useTooltipTrigger,
} from 'react-aria';
import { useTooltipTriggerState } from 'react-stately';

interface Props {
  children: ReactNode;
  message: ReactNode;
  position?: 'bottom' | 'top' | 'right' | 'left';
  className?: string;
  delay?: number;
  selectable?: boolean;
  wide?: boolean;
}

export const Tooltip = (props: Props) => {
  const { children, message, className, selectable, wide, delay, ...rest } = props;
  const state = useTooltipTriggerState({ ...props, delay });
  const triggerRef = React.useRef(null);
  const overlayRef = React.useRef(null);
  const trigger = useTooltipTrigger(props, state, triggerRef);
  const { tooltipProps } = useTooltip(trigger.tooltipProps, state);

  const { overlayProps: positionProps } = useOverlayPosition({
    targetRef: triggerRef,
    overlayRef,
    placement: 'top',
    offset: 5,
    isOpen: state.isOpen,
  });

  const tooltipClasses = classnames(className, 'tooltip');
  const bubbleClasses = classnames('tooltip__bubble theme--tooltip', {
    'tooltip__bubble--visible': state.isOpen,
    'tooltip__bubble--wide': wide,
    selectable: selectable,
  });

  return (
    <div
      ref={triggerRef}
      className={tooltipClasses}
      style={{ position: 'relative' }}
    >
      {state.isOpen && (
        <OverlayContainer>
          <div
            ref={overlayRef}
            {...mergeProps(rest, tooltipProps, positionProps)}
            className={bubbleClasses}
          >
            {message}
          </div>
        </OverlayContainer>
      )}
      {isValidElement(children) &&
        React.cloneElement(children, {
          ...trigger.triggerProps,
          ...children.props,
        })}
    </div>
  );
};

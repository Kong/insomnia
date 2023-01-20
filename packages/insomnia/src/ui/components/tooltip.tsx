import classnames from 'classnames';
import React, {
  CSSProperties,
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
  selectable?: boolean;
  delay?: number;
  wide?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
}

export const Tooltip = (props: Props) => {
  const { children, message, className, wide, selectable, delay = 400, position, style } = props;
  const triggerRef = React.useRef(null);
  const overlayRef = React.useRef(null);

  const state = useTooltipTriggerState({ delay });
  const trigger = useTooltipTrigger(props, state, triggerRef);
  const tooltip = useTooltip(trigger.tooltipProps, state);

  const { overlayProps: positionProps } = useOverlayPosition({
    targetRef: triggerRef,
    overlayRef,
    placement: position,
    offset: 5,
    isOpen: state.isOpen,
  });

  const tooltipClasses = classnames(className, 'tooltip');
  const bubbleClasses = classnames('tooltip__bubble theme--tooltip', {
    'tooltip__bubble--visible': state.isOpen,
    'tooltip__bubble--wide': wide,
    selectable,
  });

  return (
    <div
      ref={triggerRef}
      className={tooltipClasses}
      style={{ position: 'relative', ...style }}
      {...trigger.triggerProps}
      onClick={props.onClick}
    >
      {children}
      {state.isOpen && (
        <OverlayContainer>
          <div
            ref={overlayRef}
            onClick={e => e.stopPropagation()}
            {...mergeProps(tooltip.tooltipProps, positionProps)}
            className={bubbleClasses}
          >
            {message}
          </div>
        </OverlayContainer>
      )}
    </div>
  );
};

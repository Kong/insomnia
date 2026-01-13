import classnames from 'classnames';
import React, { type CSSProperties, type ReactNode } from 'react';
import { mergeProps, OverlayContainer, useOverlayPosition, useTooltip, useTooltipTrigger } from 'react-aria';
import { createPortal } from 'react-dom';
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
  portalContainer?: HTMLElement | null;
}

export const Tooltip = (props: Props) => {
  const { children, message, className, wide, selectable, delay = 400, position, style, portalContainer } = props;
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

  const overlayContent = (
    <div
      ref={overlayRef}
      onClick={e => e.stopPropagation()}
      {...mergeProps(tooltip.tooltipProps, positionProps)}
      className={bubbleClasses}
    >
      {message}
    </div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        className={tooltipClasses}
        style={{ position: 'relative', ...style }}
        {...trigger.triggerProps}
        onClick={props.onClick}
      >
        {children}
      </div>
      {state.isOpen &&
        (portalContainer ? (
          // Render tooltip inside customized portal(used in modal); otherwise the overlay container becomes inert and breaks hover
          createPortal(overlayContent, portalContainer)
        ) : (
          <OverlayContainer>{overlayContent}</OverlayContainer>
        ))}
    </>
  );
};

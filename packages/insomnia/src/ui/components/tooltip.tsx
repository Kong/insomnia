import classnames from 'classnames';
import React, { type CSSProperties, type ReactNode, useEffect } from 'react';
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
  // Anchors the tooltip to the mouse position instead of the trigger element's bounding
  // box. Useful when the trigger is much wider/taller than its actual visible content
  // (e.g. a text field that fills a whole table cell) - anchoring to the trigger box would
  // place the tooltip relative to the cell, not to whatever the user is actually hovering.
  followCursor?: boolean;
}

export const Tooltip = (props: Props) => {
  const { children, message, className, wide, selectable, delay = 400, position, style, followCursor } = props;
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const dwellTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorPosRef = React.useRef({ x: 0, y: 0 });

  const state = useTooltipTriggerState({ delay });
  // react-stately shares a single "warmup" timer across every tooltip on the page: once one
  // tooltip has shown, any other tooltip opens almost instantly for the next 500ms instead of
  // waiting out `delay`. Quickly sweeping the mouse across many trigger elements (e.g. table
  // rows) then makes each one flash open and closed in turn. `trigger: 'focus'` tells
  // useTooltipTrigger to ignore hover entirely (keyboard/focus accessibility is unaffected),
  // and we open/close on hover ourselves below with a plain dwell timer, so showing a tooltip
  // always waits the full `delay` no matter what any other tooltip just did.
  const trigger = useTooltipTrigger({ ...props, trigger: 'focus' }, state, triggerRef);
  const tooltip = useTooltip(trigger.tooltipProps, state);

  const { overlayProps: positionProps } = useOverlayPosition({
    targetRef: triggerRef,
    overlayRef,
    placement: position,
    offset: 5,
    isOpen: state.isOpen && !followCursor,
  });

  const clearDwellTimeout = () => {
    if (dwellTimeout.current) {
      clearTimeout(dwellTimeout.current);
      dwellTimeout.current = null;
    }
  };

  const handleMouseEnter = () => {
    clearDwellTimeout();
    dwellTimeout.current = setTimeout(() => {
      dwellTimeout.current = null;
      state.open(true);
    }, delay);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (followCursor) {
      cursorPosRef.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseLeave = () => {
    clearDwellTimeout();
    state.close(true);
  };

  useEffect(() => clearDwellTimeout, []);

  const tooltipClasses = classnames(className, 'tooltip');
  const bubbleClasses = classnames('tooltip__bubble theme--tooltip', {
    'tooltip__bubble--visible': state.isOpen,
    'tooltip__bubble--wide': wide,
    selectable,
  });

  const cursorStyle: CSSProperties = followCursor
    ? { position: 'fixed', top: cursorPosRef.current.y + 16, left: cursorPosRef.current.x + 12, margin: 0 }
    : {};

  const overlayContent = message ? (
    <div
      ref={overlayRef}
      onClick={e => e.stopPropagation()}
      {...mergeProps(tooltip.tooltipProps, followCursor ? {} : positionProps)}
      style={followCursor ? cursorStyle : undefined}
      className={bubbleClasses}
    >
      {message}
    </div>
  ) : null;

  const modalContainer = triggerRef.current?.closest('[aria-label="Modal"]');

  return (
    <>
      <div
        ref={triggerRef}
        className={tooltipClasses}
        style={{ position: 'relative', ...style }}
        {...trigger.triggerProps}
        onMouseEnter={handleMouseEnter}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={props.onClick}
      >
        {children}
      </div>
      {state.isOpen &&
        overlayContent &&
        (modalContainer ? (
          // Render tooltip inside modal if exists.
          // Otherwise OverlayContainer becomes inert and breaks hover event listener: INS-1930
          createPortal(overlayContent, modalContainer)
        ) : (
          <OverlayContainer>{overlayContent}</OverlayContainer>
        ))}
    </>
  );
};

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { OverlayContainer,useOverlayPosition } from 'react-aria';
import { createPortal } from 'react-dom';

import type { VariableSourceTooltipState } from './.client/codemirror/extensions/variable-source-tooltip';
import {
  getVariableSourceTooltipState,
  hideVariableSourceTooltip,
  setPointerInBubble,
  subscribeVariableSourceTooltip,
} from './.client/codemirror/extensions/variable-source-tooltip';

/**
 * Renders the variable source tooltip for CodeMirror inline widgets. The trigger is
 * plain DOM outside the React tree, so the hover timing lives in
 * `variable-source-tooltip.ts` (controller) and this host only renders and positions
 * the bubble with the shared tooltip stack (`useOverlayPosition` + tooltip CSS).
 */
export const VariableSourceTooltipHost = () => {
  const [state, setState] = useState<VariableSourceTooltipState | null>(getVariableSourceTooltipState());
  useEffect(() => subscribeVariableSourceTooltip(setState), []);

  // The overlay position is only computed for the shown state; hide on scroll rather
  // than letting the bubble sit stale over moved content.
  useEffect(() => {
    const hideOnScroll = () => hideVariableSourceTooltip();
    window.addEventListener('scroll', hideOnScroll, true);
    return () => window.removeEventListener('scroll', hideOnScroll, true);
  }, []);

  const overlayRef = useRef<HTMLDivElement>(null);
  // The trigger is a plain CodeMirror widget node; wrap it in a ref-like object for
  // useOverlayPosition.
  const targetRef = useMemo(() => ({ current: state?.target ?? null }), [state]);

  const { overlayProps } = useOverlayPosition({
    targetRef,
    overlayRef,
    placement: 'top',
    offset: 6,
    isOpen: state !== null,
    shouldFlip: true,
  });

  if (!state) {
    return null;
  }

  return (
    <OverlayContainer>
      {createPortal(
        <div
          ref={overlayRef}
          {...overlayProps}
          data-testid="variable-source-tooltip"
          className="tooltip__bubble theme--tooltip tooltip__bubble--visible tooltip__bubble--wide p-2 text-xs text-left text-(--color-font) whitespace-pre-wrap!"
          onMouseEnter={() => setPointerInBubble(true)}
          onMouseLeave={() => setPointerInBubble(false)}
        >
          <div className="max-h-40 overflow-hidden font-mono">{state.value}</div>
          {state.source && (
            <div className="mt-1 flex items-center gap-2 border-t border-solid border-(--hl-md) pt-1">
              <span className="truncate italic">{state.source.label}</span>
              {state.source.onOpen && (
                <button
                  type="button"
                  data-testid="variable-source-tooltip-open"
                  className="shrink-0 cursor-pointer rounded-xs border border-solid border-(--hl-md) bg-transparent px-2 leading-relaxed hover:bg-(--hl-xs)"
                  onClick={() => state.source?.onOpen?.()}
                >
                  Open <i className="fa fa-arrow-right text-[0.65rem]" />
                </button>
              )}
            </div>
          )}
        </div>,
        document.body,
      )}
    </OverlayContainer>
  );
};

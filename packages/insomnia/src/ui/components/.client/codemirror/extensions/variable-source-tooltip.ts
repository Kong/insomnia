export interface VariableSourceTooltipState {
  target: HTMLElement;
  value: string;
  source?: {
    label: string;
    onOpen?: () => void;
  };
}

type Listener = (state: VariableSourceTooltipState | null) => void;

// Matches the dwell delay of the React <Tooltip> component.
const SHOW_DELAY_MS = 400;
// Long enough to move from the tag into the tooltip across the positioning gap.
const GRACE_PERIOD_MS = 350;
// Re-hovering the same tag shortly after the tooltip was shown skips the dwell,
// so quickly moving away and back doesn't feel like the tooltip vanished.
const RECENT_RESHOW_WINDOW_MS = 1000;
// Modals carry this label (see base/modal.tsx); the React <Tooltip> uses the same
// selector to detect them. While one is open, hover tooltips would stack on top of it.
const MODAL_SELECTOR = '[aria-label="Modal"]';

// The tooltip's trigger is a plain CodeMirror widget outside the React tree, so this
// controller owns the hover timing (dwell, grace, re-show) and publishes the state;
// VariableSourceTooltipHost renders it with the shared tooltip positioning stack.
let displayed: VariableSourceTooltipState | null = null;
// Whether the pointer is currently over the rendered bubble. The chip-side mouseleave
// can arrive out of order after the bubble's mouseenter (React synthesizes enter from
// mouseover while the native leave fires separately); while the pointer is inside the
// bubble, a chip-side hide must not win.
let pointerInBubble = false;
let pending: VariableSourceTooltipState | null = null;
let showTimeout: number | null = null;
let hideTimeout: number | null = null;
let lastShownTarget: HTMLElement | null = null;
let lastShownAt = 0;
// The chip the pointer is currently over. The mouseenter handler is async (render +
// context fetch); if the pointer leaves during that await, the late show call must
// not arm a tooltip for a chip the pointer has already left.
let hoveredTarget: HTMLElement | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) {
    listener(displayed);
  }
}

function clearShowTimeout() {
  if (showTimeout !== null) {
    window.clearTimeout(showTimeout);
    showTimeout = null;
  }
  pending = null;
}

function clearHideTimeout() {
  if (hideTimeout !== null) {
    window.clearTimeout(hideTimeout);
    hideTimeout = null;
  }
}

export function subscribeVariableSourceTooltip(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getVariableSourceTooltipState(): VariableSourceTooltipState | null {
  return displayed;
}

// Whether the displayed tooltip is anchored inside the given element. Callers that
// hide the module-global tooltip on their own lifecycle events (editor unmount or
// mark refresh) use this to limit the hide to their own tooltips, so one editor
// cannot kill a tooltip displayed for a chip in another editor.
export function isVariableSourceTooltipInside(element: HTMLElement | null): boolean {
  const state = getVariableSourceTooltipState();
  return Boolean(state && element?.contains(state.target));
}

export function setHoveredVariableSourceTarget(target: HTMLElement | null) {
  hoveredTarget = target;
}

export function hideVariableSourceTooltip() {
  clearShowTimeout();
  clearHideTimeout();
  if (displayed) {
    displayed = null;
    emit();
  }
}

export function scheduleHideVariableSourceTooltip() {
  clearShowTimeout();
  // Nothing displayed yet (still dwelling) — just cancel the pending show.
  if (!displayed) {
    return;
  }
  // The pointer may have moved into the bubble before this leave was dispatched;
  // the bubble's own enter/leave keeps it alive in that case.
  if (pointerInBubble) {
    return;
  }
  clearHideTimeout();
  hideTimeout = window.setTimeout(hideVariableSourceTooltip, GRACE_PERIOD_MS);
}

// Called by the host when the pointer enters/leaves the rendered bubble.
export function setPointerInBubble(inBubble: boolean) {
  pointerInBubble = inBubble;
  if (inBubble) {
    clearHideTimeout();
  } else if (displayed) {
    scheduleHideVariableSourceTooltip();
  }
}

export function showVariableSourceTooltip(options: VariableSourceTooltipState) {
  // Never surface a hover tooltip on top of an open modal.
  if (document.querySelector(MODAL_SELECTOR)) {
    hideVariableSourceTooltip();
    return;
  }
  // A stale hover render for a chip the pointer already left must not clobber the
  // pending show for the chip now under the pointer.
  if (options.target !== hoveredTarget) {
    return;
  }
  // A new hover means the pointer is over a chip, not inside the bubble.
  pointerInBubble = false;
  clearHideTimeout();
  // Re-dwelling restarts the timer; moving to an adjacent tag swaps the pending target.
  clearShowTimeout();
  pending = options;
  const isRecentReshow = options.target === lastShownTarget && Date.now() - lastShownAt < RECENT_RESHOW_WINDOW_MS;
  showTimeout = window.setTimeout(
    () => {
      const next = pending;
      clearShowTimeout();
      // The mark may have been rebuilt (or the editor unmounted) during the dwell;
      // never surface a tooltip anchored to a detached element.
      if (!next || !next.target.isConnected) {
        return;
      }
      if (document.querySelector(MODAL_SELECTOR)) {
        return;
      }
      // The pointer may have moved on (or off) during the async hover render.
      if (hoveredTarget !== next.target) {
        return;
      }
      displayed = next;
      lastShownTarget = next.target;
      lastShownAt = Date.now();
      emit();
    },
    isRecentReshow ? 0 : SHOW_DELAY_MS,
  );
}

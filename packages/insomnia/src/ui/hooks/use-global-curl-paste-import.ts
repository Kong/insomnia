import { useEffect, useRef } from 'react';

import { isCurlCommand } from '~/common/utils/curl';

/**
 * Returns true when the paste target is an editable surface (input, textarea,
 * or contenteditable — CodeMirror editors included). Pasting there should
 * insert text normally; only pastes landing outside editable surfaces (i.e.
 * with no clear focus) are candidates for the cURL import flow.
 */
export const isEditablePasteTarget = (target: unknown): boolean => {
  if (!target || typeof target !== 'object') {
    return false;
  }
  // Duck-typed so the guard stays unit-testable outside a DOM environment.
  const element = target as { tagName?: string; isContentEditable?: boolean };
  return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable === true;
};

interface Options {
  // Whether the listener is active.
  enabled: boolean;
  // Called with the pasted text once it matches the cURL shape. The paste
  // event's default action has been prevented by then.
  onCurlPaste: (curl: string) => void;
}

export const useGlobalCurlPasteImport = ({ enabled, onCurlPaste }: Options) => {
  const onCurlPasteRef = useRef(onCurlPaste);
  onCurlPasteRef.current = onCurlPaste;

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const handlePaste = (event: ClipboardEvent) => {
      if (isEditablePasteTarget(event.target)) {
        return;
      }
      const text = event.clipboardData?.getData('text/plain').trim();
      if (!text || !isCurlCommand(text)) {
        return;
      }
      event.preventDefault();
      onCurlPasteRef.current(text);
    };
    // Capture phase so the listener observes the paste even when it is
    // dispatched straight to the focused element (or body).
    document.addEventListener('paste', handlePaste, true);
    return () => document.removeEventListener('paste', handlePaste, true);
  }, [enabled]);
};

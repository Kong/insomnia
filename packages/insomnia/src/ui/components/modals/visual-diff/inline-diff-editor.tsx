import { useEffect, useRef, useState } from 'react';

import { useIsLightTheme } from '~/ui/hooks/theme';

import { monaco } from '../../monaco.client';

// Approximate height of one editor line, used to size the placeholder before the editor exists.
const LINE_HEIGHT = 19;
// A folded diff rarely shows more than this many lines, so the placeholder doesn't need to either.
const MAX_PLACEHOLDER_LINES = 12;

// Read-only side-by-side diff for a long before/after value inside a card (eg. a request body or
// an API spec), with changed words highlighted and unchanged regions folded away. The editor is
// only created once it scrolls near the viewport — a file can have dozens of these, and creating
// them all at once freezes the UI — and then grows to fit its content instead of scrolling.
export const InlineDiffEditor = ({
  original,
  modified,
  language,
}: {
  original: string;
  modified: string;
  language: string;
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isLightTheme = useIsLightTheme();
  const [isNearViewport, setIsNearViewport] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || isNearViewport) {
      return;
    }
    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setIsNearViewport(true);
        }
      },
      { rootMargin: '300px 0px' },
    );
    observer.observe(container);
    return () => observer.disconnect();
  }, [isNearViewport]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isNearViewport) {
      return;
    }
    const editor = monaco.editor.createDiffEditor(container, {
      readOnly: true,
      renderSideBySide: true,
      useInlineViewWhenSpaceIsLimited: true,
      ignoreTrimWhitespace: false,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      contextmenu: false,
      minimap: { enabled: false },
      renderOverviewRuler: false,
      enableSplitViewResizing: false,
      folding: false,
      wordWrap: 'on',
      diffWordWrap: 'on',
      // The editor is as tall as its content, so wheel events should scroll the card list instead.
      scrollbar: { vertical: 'hidden', alwaysConsumeMouseWheel: false },
      hideUnchangedRegions: { enabled: true, contextLineCount: 2, minimumLineCount: 3, revealLineCount: 20 },
      theme: isLightTheme ? 'vs' : 'vs-dark',
    });
    const originalModel = monaco.editor.createModel(original, language);
    const modifiedModel = monaco.editor.createModel(modified, language);
    editor.setModel({ original: originalModel, modified: modifiedModel });

    // Content height changes once the diff is computed and unchanged regions are folded (or revealed).
    const fitToContent = () => {
      const height = Math.max(
        editor.getOriginalEditor().getContentHeight(),
        editor.getModifiedEditor().getContentHeight(),
      );
      container.style.height = `${height}px`;
      editor.layout();
    };
    const subscriptions = [
      editor.getOriginalEditor().onDidContentSizeChange(fitToContent),
      editor.getModifiedEditor().onDidContentSizeChange(fitToContent),
      editor.onDidUpdateDiff(fitToContent),
    ];
    fitToContent();

    return () => {
      subscriptions.forEach(subscription => subscription.dispose());
      editor.setModel(null);
      editor.dispose();
      originalModel.dispose();
      modifiedModel.dispose();
    };
  }, [original, modified, language, isLightTheme, isNearViewport]);

  const lineCount = Math.max(original.split('\n').length, modified.split('\n').length);
  return (
    <div
      ref={containerRef}
      className="w-full overflow-hidden rounded-xs bg-(--color-bg)"
      style={{ height: Math.min(MAX_PLACEHOLDER_LINES, lineCount) * LINE_HEIGHT + 8 }}
    />
  );
};

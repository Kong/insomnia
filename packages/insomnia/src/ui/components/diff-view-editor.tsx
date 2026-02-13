import { useEffect, useRef } from 'react';

import { findSystemChangeLines } from '~/common/significant-diff-detection';
import { useIsLightTheme } from '~/ui/hooks/theme';

import { monaco } from './monaco.client';

interface DiffEditorProps {
  original: string;
  modified: string;
  highlightSystemChange?: boolean;
}

export const DiffEditor = ({ original, modified, highlightSystemChange = false }: DiffEditorProps) => {
  const monacoEl = useRef<HTMLDivElement | null>(null);

  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const modelsRef = useRef<{
    original?: monaco.editor.ITextModel;
    modified?: monaco.editor.ITextModel;
  }>({});

  const isLightTheme = useIsLightTheme();
  const isLightThemeRef = useRef(isLightTheme);

  // 2) Create the diff editor ONCE (mount)
  useEffect(() => {
    if (!monacoEl.current) return;

    const diffEditor = monaco.editor.createDiffEditor(monacoEl.current, {
      ariaLabel: 'Diff Editor',
      renderSideBySide: true,
      useInlineViewWhenSpaceIsLimited: true,
      readOnly: true,
      scrollBeyondLastLine: false,
      automaticLayout: true,
      contextmenu: false,
      minimap: { enabled: false },
      hideUnchangedRegions: {
        enabled: true,
        contextLineCount: 3,
        minimumLineCount: 3,
        revealLineCount: 20,
      },
      enableSplitViewResizing: false,
      theme: isLightThemeRef.current ? 'vs' : 'vs-dark',
      glyphMargin: highlightSystemChange,
    });

    editorRef.current = diffEditor;

    // Layout next frame (helps in Electron)
    requestAnimationFrame(() => diffEditor.layout(undefined, true));

    return () => {
      // Detach models first
      diffEditor.setModel(null);

      // Dispose editor
      diffEditor.dispose();

      // Dispose models
      const { original, modified } = modelsRef.current;
      modelsRef.current = {};

      setTimeout(() => {
        original?.dispose();
        modified?.dispose();
      }, 0);

      editorRef.current = null;
    };
  }, [highlightSystemChange]);

  // 3) Update models ONLY when original/modified change
  useEffect(() => {
    const diffEditor = editorRef.current;
    if (!diffEditor) return;

    // Dispose previous models
    const prev = modelsRef.current;
    modelsRef.current = {};

    // Important: reset model first to avoid "disposed before reset" issues
    diffEditor.setModel(null);

    setTimeout(() => {
      prev.original?.dispose();
      prev.modified?.dispose();
    }, 0);

    // Create new models
    const originalModel = monaco.editor.createModel(original, 'yaml');
    const modifiedModel = monaco.editor.createModel(modified, 'yaml');

    modelsRef.current = { original: originalModel, modified: modifiedModel };

    // Set new models
    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel,
    });

    const originalEditor = diffEditor.getOriginalEditor();
    const modifiedEditor = diffEditor.getModifiedEditor();

    // Add system change decorations if enabled
    if (highlightSystemChange) {
      const systemChangeLines = findSystemChangeLines(original, modified);
      systemChangeLines.originalLines.forEach(lineNumber => {
        addLineDecoration(originalEditor, lineNumber);
      });
      systemChangeLines.modifiedLines.forEach(lineNumber => {
        addLineDecoration(modifiedEditor, lineNumber);
      });
    }

    diffEditor.layout(undefined, true);
  }, [original, modified, highlightSystemChange]);

  return <div className="h-full w-full" ref={monacoEl} />;
};

const hoverMessage = [
  {
    value: 'This is a required change to Insomnia metadata\n\nand can not be manually edited or discarded.',
  },
];

function addLineDecoration(editor: monaco.editor.IStandaloneCodeEditor, lineNumber: number) {
  editor.createDecorationsCollection([
    {
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      options: {
        className: 'system-change-line-bg',
        glyphMarginClassName: 'info-decoration',
        hoverMessage: hoverMessage,
        glyphMarginHoverMessage: hoverMessage,
        isWholeLine: true,
        showIfCollapsed: false,
      },
    },
  ]);
}

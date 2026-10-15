import { useEffect, useRef } from 'react';

import { findSystemChangeLines } from '~/common/significant-diff-detection';
import { useIsLightTheme } from '~/ui/hooks/theme';

import { monaco } from './monaco.client';

export interface DiffEditorHighlight {
  startLine: number;
  endLine: number;
  message: string;
}

interface DiffEditorProps {
  original: string;
  modified: string;
  highlightSystemChange?: boolean;
  // Lines of `original` to highlight, e.g. fields this version of Insomnia doesn't recognize.
  originalHighlights?: DiffEditorHighlight[];
}

// A stable default: a fresh `[]` per render would re-run the models effect on every render.
const NO_HIGHLIGHTS: DiffEditorHighlight[] = [];

export const DiffEditor = ({
  original,
  modified,
  highlightSystemChange = false,
  originalHighlights = NO_HIGHLIGHTS,
}: DiffEditorProps) => {
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
        revealLineCount: 200,
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

    // In the inline view (the default when the editor is narrower than 900px) removed lines are rendered as view zones
    // that ignore decorations on the original editor, so highlights would never show. Stay side-by-side for them.
    diffEditor.updateOptions({ useInlineViewWhenSpaceIsLimited: originalHighlights.length === 0 });

    // Set new models
    diffEditor.setModel({
      original: originalModel,
      modified: modifiedModel,
    });

    // Decorations belong to the model, so they are dropped together with it when the models are replaced
    if (originalHighlights.length > 0) {
      diffEditor.getOriginalEditor().createDecorationsCollection(
        originalHighlights.flatMap(({ startLine, endLine, message }) => {
          const common = {
            className: 'unknown-field-line-bg',
            isWholeLine: true,
            showIfCollapsed: false,
          };
          return [
            // The start line is the only one with a warning icon in the glyph margin
            {
              range: new monaco.Range(startLine, 1, startLine, 1),
              options: {
                ...common,
                glyphMarginClassName: 'warning-decoration',
                glyphMarginHoverMessage: { value: message },
              },
            },
            ...(endLine > startLine
              ? [{ range: new monaco.Range(startLine + 1, 1, endLine, 1), options: common }]
              : []),
          ];
        }),
      );
    }

    // Add system change decorations if enabled
    if (highlightSystemChange) {
      setTimeout(() => {
        let lineChanges = diffEditor.getLineChanges();
        if (Array.isArray(lineChanges)) {
          // It means the block is removed when modifiedEndLineNumber is smaller than modifiedStartLineNumber in a line change
          // We only care about the changes in the modified block and added block
          lineChanges = lineChanges.filter(
            ({ modifiedStartLineNumber, modifiedEndLineNumber }) => modifiedEndLineNumber >= modifiedStartLineNumber,
          );

          if (lineChanges.length > 0) {
            const modifiedEditor = diffEditor.getModifiedEditor();

            const systemChangeLineIntervals = findSystemChangeLines(modified, lineChanges);
            systemChangeLineIntervals.forEach(({ start, end }) => {
              addLineDecoration(modifiedEditor, start, end);
            });
          }
        }
      }, 0);
    }

    diffEditor.layout(undefined, true);
  }, [original, modified, highlightSystemChange, originalHighlights]);

  return <div className="h-full w-full" ref={monacoEl} />;
};

const hoverMessage = [
  {
    value: 'This is a required change to Insomnia metadata\n\nand can not be manually edited or discarded.',
  },
];

function addLineDecoration(
  editor: monaco.editor.IStandaloneCodeEditor,
  startLineNumber: number,
  endLineNumber: number,
) {
  // The start line will always have a glyph margin icon
  editor.createDecorationsCollection([
    {
      range: new monaco.Range(startLineNumber, 1, startLineNumber, 1),
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
  // The rest lines will only have background decoration, no glyph margin icon
  if (endLineNumber > startLineNumber) {
    editor.createDecorationsCollection([
      {
        range: new monaco.Range(startLineNumber + 1, 1, endLineNumber, 1),
        options: {
          className: 'system-change-line-bg',
          hoverMessage: hoverMessage,
          glyphMarginHoverMessage: hoverMessage,
          isWholeLine: true,
          showIfCollapsed: false,
        },
      },
    ]);
  }
}

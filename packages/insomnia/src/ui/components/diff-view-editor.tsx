import { useEffect, useRef } from 'react';
import { parseColor } from 'react-aria-components';

import { useRootLoaderData } from '~/root';

import { monaco } from './monaco.client';

export const DiffEditor = ({ original, modified }: { original: string; modified: string }) => {
  const monacoEl = useRef<HTMLDivElement | null>(null);

  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const modelsRef = useRef<{
    original?: monaco.editor.ITextModel;
    modified?: monaco.editor.ITextModel;
  }>({});

  const { settings } = useRootLoaderData()!;

  // 1) Define theme when settings change
  useEffect(() => {
    const computedStyles = window.getComputedStyle(document.body);

    function getColorVariableAsHex(colorVariable: string, lightnessLimit = 100) {
      try {
        const color = parseColor(computedStyles.getPropertyValue(colorVariable));
        if (color.toFormat('hsl').getChannelValue('lightness') > lightnessLimit) {
          return color.toFormat('hsl').withChannelValue('lightness', lightnessLimit).toString('hex');
        }
        return color.toString('hex');
      } catch (e) {
        console.error('Failed to parse color', e);
        return '#ffffff00';
      }
    }

    monaco.editor.defineTheme('insomnia', {
      base: 'vs',
      inherit: true,
      rules: [],
      colors: {
        'focusBorder': '#ffffff00',
        'editor.background': '#ffffff00',
        'editorCursor.foreground': getColorVariableAsHex('--color-font'),
        'scrollbar.shadow-sm': getColorVariableAsHex('--color-bg'),
        'editor.lineHighlightBorder': getColorVariableAsHex('--hl', 30),
        'editor.foreground': getColorVariableAsHex('--color-font'),
        'editor.selectionBackground': getColorVariableAsHex('--hl'),
        'editor.inactiveSelectionBackground': getColorVariableAsHex('--hl'),
        'editor.selectionForeground': getColorVariableAsHex('--color-font'),
        'diffEditor.insertedTextBackground': getColorVariableAsHex('--color-success', 20),
        'diffEditor.removedTextBackground': getColorVariableAsHex('--color-danger', 20),
        'diffEditor.insertedLineBackground': getColorVariableAsHex('--color-success', 40),
        'diffEditor.removedLineBackground': getColorVariableAsHex('--color-danger', 40),
        'diffEditorGutter.insertedLineBackground': getColorVariableAsHex('--color-success', 40),
        'diffEditorGutter.removedLineBackground': getColorVariableAsHex('--color-danger', 40),
        'diffEditorOverview.insertedForeground': getColorVariableAsHex('--color-success', 20),
        'diffEditorOverview.removedForeground': getColorVariableAsHex('--color-danger', 20),
        'diffEditor.unchangedRegionBackground': getColorVariableAsHex('--color-bg'),
        'diffEditor.unchangedRegionForeground': getColorVariableAsHex('--color-font'),
        'diffEditor.unchangedCodeBackground': getColorVariableAsHex('--color-bg'),
        'diffEditor.diagonalFill': getColorVariableAsHex('--color-notice', 20),
      },
    });

    // Apply theme (global)
    monaco.editor.setTheme('insomnia');

    // Re-layout if editor exists
    editorRef.current?.layout(undefined, true);
  }, [settings]);

  // 2) Create the diff editor ONCE (mount)
  useEffect(() => {
    if (!monacoEl.current) return;

    const diffEditor = monaco.editor.createDiffEditor(monacoEl.current, {
      ariaLabel: 'Diff Editor',
      renderSideBySide: true,
      useInlineViewWhenSpaceIsLimited: true,
      readOnly: true,
      lineNumbers: 'off',
      scrollBeyondLastLine: false,
      automaticLayout: true,
      contextmenu: false,
      minimap: { enabled: false },
    });

    editorRef.current = diffEditor;

    // Make sure theme vars are applied
    monaco.editor.setTheme('insomnia');

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
  }, []);

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

    // Re-apply theme vars + layout (cheap)
    monaco.editor.setTheme('insomnia');
    diffEditor.layout(undefined, true);
  }, [original, modified]);

  return <div className="h-full w-full" ref={monacoEl} />;
};

import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import React from 'react';
import { useEffect, useRef } from 'react';
import { parseColor } from 'react-aria-components';

import { useRootLoaderData } from '../routes/root';

export const DiffEditor = ({
  original,
  modified,
}: {
  original: string;
  modified: string;
}) => {
  const monacoEl = useRef(null);
  const monacoEditorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);

  const {
    settings,
  } = useRootLoaderData();

  useEffect(() => {
    const computedStyles = window.getComputedStyle(document.body);

    function getColorVariableAsHex(colorVariable: string, lightnessLimit = 100) {
      try {
        const color = parseColor(computedStyles.getPropertyValue(colorVariable));
        if (color.toFormat('hsl').getChannelValue('lightness') > lightnessLimit) {
          const newColor = color.toFormat('hsl').withChannelValue('lightness', lightnessLimit);

          return newColor.toString('hex');
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
        'scrollbar.shadow': getColorVariableAsHex('--color-bg'),
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
  }, [settings]);

  useEffect(() => {
    if (monacoEl.current) {
      const diffEditor = monaco.editor.createDiffEditor(monacoEl.current, {
        ariaLabel: 'Diff Editor',
        theme: 'insomnia',
        renderSideBySide: true,
        useInlineViewWhenSpaceIsLimited: true,
        readOnly: true,
        lineNumbers: 'off',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        contextmenu: false,
        minimap: {
          enabled: false,
        },
      });

      diffEditor.setModel({
        original: monaco.editor.createModel(original, 'yaml'),
        modified: monaco.editor.createModel(modified, 'yaml'),
      });

      monacoEditorRef.current = diffEditor;

      return () => diffEditor?.dispose();
    }

    return () => { };
  }, [modified, original]);

  return <div className='w-full h-full' ref={monacoEl} />;
};

import classnames from 'classnames';
import * as monaco from 'monaco-editor';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMount, useUnmount } from 'react-use';

import type { HandleGetRenderContext, HandleRender } from '../../../common/render';
import { getTagDefinitions } from '../../../templating';
import { tokenizeTag } from '../../../templating/utils';
import { useGatedNunjucks } from '../../context/nunjucks/use-gated-nunjucks';
import { useRootLoaderData } from '../../routes/root';
import { showModal } from '../modals/index';
import { NunjucksModal } from '../modals/nunjucks-modal';
import { getMatchTokens } from './languages/nunjucks/modes';
import { languageId } from './languages/openapi/apidom';

export const CodeEditor = ({ id, readOnly, className, dynamicHeight, style, defaultValue, enableNunjucks }: any) => {
  const textAreaRef = useRef<HTMLDivElement>(null);
  const monacoEditor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsCount = useRef(0);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const {
    settings,
  } = useRootLoaderData();
  const { handleRender, handleGetRenderContext } = useGatedNunjucks({ disabled: !enableNunjucks });

  const initEditor = () => {
    if (!textAreaRef.current) {
      return;
    }
    monacoEditor.current = monaco.editor.create(textAreaRef.current, {
      value: '{\n\
    "username": "{{ username }}",\n\
    "password": "{{ password }}",\n\
    "result": "{% base64 \'encode\', \'normal\', \'test\' %}"  hello\n\
  }',
      language: languageId,
      lineNumbers: 'on',
      theme: 'vs-dark',
      wordWrap: 'on',
      automaticLayout: true,
      wordBasedSuggestions: 'off',
      minimap: {
        enabled: false,
      },
      stickyScroll: {
        enabled: false,
      },
      readOnly,
    });
    setIsEditorReady(true);
    applyTokenDecorations();
  };

  const applyTokenDecorations = () => {
    const editor = monacoEditor.current;
    if (editor) {
      const model = editor.getModel()!;
      const existingDecorationIds = model.getAllDecorations().filter(d => d.options.inlineClassName === 'invisible-token').map(d => d.id);
      editor.removeDecorations(existingDecorationIds);
      const renderCacheKey = Math.random() + '';
      const renderString = (text: any) => handleRender!(text, renderCacheKey);
      const getRenderContext = () => handleGetRenderContext!(renderCacheKey);

      const matches = getMatchTokens(model);
      // Find all matches for {{ token }}
      // const regexVariable = /^{{\s*([^ }]+)\s*[^}]*\s*}}/;
      // const regexTag = /^{%\s*([^ }]+)\s*[^%]*\s*%}/;

      // Create decorations
      const decorations: monaco.editor.IModelDeltaDecoration[] = matches.map(({ range, token, type }) => {
        return {
          range: range,
          options: {
            inlineClassName: 'invisible-token', // Hide the braces
            afterContentClassName: 'visible-token', // Show the token
            after: {
              attachedData: model.getValueInRange(range),
              content: token,
              inlineClassName: `nunjucks-tag ${type === 'variable' ? 'nunjucks-variable' : ''}`, // Style for the visible token
              cursorStops: monaco.editor.InjectedTextCursorStops.Both,
            },
          },
        };
      });
      // Apply the decorations
      decorationsCount.current = editor.createDecorationsCollection(decorations).length;
    }
  };

  // Function to handle content change
  const handleContentChange = useCallback(() => {
    const editor = monacoEditor.current;
    if (editor) {
      const model = editor.getModel()!;
      const value = model.getValue();
      const tokenPattern = /\{\{\s*([^\s\}]+)\s*\}\}/g;
      let hasRemovedToken = false;
      // Detect if the user has deleted a token by checking the remaining value
      const updatedMatches = value.match(tokenPattern) || [];

      // If the number of tokens in the value has decreased, trigger a re-decoration
      const decoLength = decorationsCount.current || 0;
      if (updatedMatches.length < decoLength) {
        hasRemovedToken = true;
      }

      // Apply new decorations if a token was deleted or added
      if (hasRemovedToken) {
        applyTokenDecorations();
      }
    }
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const editor = monacoEditor.current;

    const getDecorationOffsets = (model: monaco.editor.ITextModel, range: monaco.Range) => {
      const startOffset = model.getOffsetAt({ lineNumber: range.startLineNumber, column: range.startColumn });
      const endOffset = model.getOffsetAt({ lineNumber: range.endLineNumber, column: range.endColumn });
      return { startOffset, endOffset };
    };

    if (editor) {
      const model = editor.getModel()!;
      const cursorPosition = editor.getPosition()!;
      const decorations = model.getAllDecorations().filter(d => d.options.inlineClassName === 'invisible-token');

      if (e.key === 'Delete' || e.key === 'Backspace') {
        const cursorOffset = model.getOffsetAt(cursorPosition);
        const value = model.getValue();

        decorations.forEach(decoration => {
          const { startOffset, endOffset } = getDecorationOffsets(model, decoration.range);

          if (cursorOffset === startOffset && e.key === 'Delete') {
            // Delete the entire decoration (token and braces) if Delete is pressed at the boundary
            const newValue = value.slice(0, startOffset) + value.slice(endOffset);
            editor.setValue(newValue);
            e.preventDefault(); // Prevent default deletion behavior
            // Restore the cursor position after the content is updated
            editor.setPosition({ lineNumber: cursorPosition.lineNumber, column: cursorPosition.column - 1 });
          }

          if (cursorOffset === endOffset && e.key === 'Backspace') {
            // Delete the entire decoration (token and braces) if Backspace is pressed at the boundary
            const newValue = value.slice(0, startOffset) + value.slice(endOffset);
            editor.setValue(newValue);
            e.preventDefault(); // Prevent default deletion behavior
            editor.setPosition({ lineNumber: cursorPosition.lineNumber, column: cursorPosition.column - 1 });
          }
        });
      };
    };
  }, []);

  const handleMouseUp = useCallback((target: monaco.editor.IMouseTarget) => {
    if (target.type === monaco.editor.MouseTargetType.CONTENT_TEXT) {
      const contentText = target as monaco.editor.IMouseTargetContentText;
      const { range } = contentText;
      // @ts-expect-error use inject options
      const injectedTextOptions = contentText.detail?.injectedText?.options as monaco.editor.InjectedTextOptions;
      const { attachedData } = injectedTextOptions;
      if (attachedData) {
        showModal(NunjucksModal, {
          // @ts-expect-error not a known property of TextMarkerOptions
          template: attachedData,
          onDone: (template: string | null) => {
            if (template !== attachedData) {
              monacoEditor.current?.getModel()?.applyEdits(
                [{
                  range,
                  text: template,
                }]
              );
            }
          },
        });
      }
    }
  }, []);

  const cleanupEditor = () => {
    monacoEditor.current?.dispose();
  };

  useMount(initEditor);
  useUnmount(() => {
    cleanupEditor();
  });

  // allow editor to resize to available space
  useEffect(() => {
    if (isEditorReady) {
      monacoEditor.current?.layout();
      monacoEditor.current?.onDidChangeModelContent((e) => {
        const editorValue = monacoEditor.current?.getValue();
        console.log(editorValue);
        applyTokenDecorations();
      });
      monacoEditor.current?.onKeyDown(e => {
        handleKeyDown(e.browserEvent);
      });
      monacoEditor.current?.onMouseUp(e => {
        handleMouseUp(e.target);
      });
      // const range = new monaco.Range(4, 14, 4, 53);
      // const editorModel = monacoEditor.current?.getModel();
      // const rangeValue = editorModel?.getValueInRange(range);
      // const ids = monacoEditor.current?.createDecorationsCollection([
      //   {
      //     range,
      //     options: {
      //       inlineClassName: 'nunjucks-display-none tags-1',
      //       after: {
      //         content: 'base64-encode',
      //         inlineClassName: 'nunjucks-tag',
      //       },
      //     },
      //   },
      // ]);

      // setTimeout(() => {
      //   const el = document.getElementsByClassName('tags-1')[0];
      //   if (el) {
      //     el.innerHTML = 'base64-encode';
      //   }
      // }, 100);
    }

  }, [handleKeyDown, handleMouseUp, isEditorReady]);

  return (
    <div
      className={classnames(className, {
        editor: true,
        'editor--dynamic-height': dynamicHeight,
        'editor--readonly': readOnly,
      })}
      style={style}
      data-editor-type="text"
      data-testid="CodeEditor"
    >
      <div
        ref={textAreaRef}
        className={classnames('editor__container', 'input', className)}
        style={{ fontSize: `${settings.editorFontSize}px` }}
        id={id}
      />
    </div>
  );
};
CodeEditor.displayName = 'CodeEditor';

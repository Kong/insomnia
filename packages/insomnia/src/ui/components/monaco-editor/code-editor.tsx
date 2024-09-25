import classnames from 'classnames';
import * as monaco from 'monaco-editor';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useMount, useUnmount } from 'react-use';

import { useGatedNunjucks } from '../../context/nunjucks/use-gated-nunjucks';
import { useRootLoaderData } from '../../routes/root';
import { showModal } from '../modals/index';
import { NunjucksModal } from '../modals/nunjucks-modal';
import { getMatchTokens, updateTokenText } from './languages/nunjucks/modes';
import { languageId } from './languages/openapi/apidom';

const getVariableHoverMessage = (name: string, value: string, source: string) => {
  const gapContent = '&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp';
  const valueContent = `<p>Value${gapContent}${value}</p>`;
  const scopeContent = `<p>Source${gapContent}${source}</p>`;
  return `<div><p><strong>${name}</strong></p>${valueContent}${scopeContent}</div>`;
};

export const CodeEditor = ({ id, readOnly, className, dynamicHeight, style, defaultValue, enableNunjucks }: any) => {
  const textAreaRef = useRef<HTMLDivElement>(null);
  const monacoEditor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsCount = useRef(0);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const {
    settings,
  } = useRootLoaderData();
  const { handleRender, handleGetRenderContext } = useGatedNunjucks();

  const initEditor = () => {
    if (!textAreaRef.current) {
      return;
    }
    monacoEditor.current = monaco.editor.create(textAreaRef.current, {
      value: '{\n\
    "username": "{{ _.username }}",\n\
    "password": "{{ _.password }}",\n\
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

  const applyTokenDecorations = useCallback(async () => {
    const editor = monacoEditor.current;
    if (editor) {
      const model = editor.getModel()!;
      const existingDecorationIds = model.getAllDecorations().filter(d => d.options.inlineClassName === 'invisible-token').map(d => d.id);
      editor.removeDecorations(existingDecorationIds);
      const renderCacheKey = Math.random() + '';
      const renderString = (text: any) => handleRender!(text, renderCacheKey);
      const getRenderContext = () => handleGetRenderContext!(renderCacheKey);

      const matches = getMatchTokens(model);

      // Create decorations
      const decorations: monaco.editor.IModelDeltaDecoration[] = await Promise.all(matches.map(async ({ range, token, type }) => {
        const {
          key, value, dataError, dataIgnore, content, cleanedStr,
        } = await updateTokenText(token, renderString, getRenderContext);
      // if (!enableNunjucks) {
      //   return {
      //     range: range,
      //     options: {
      //       inlineClassName: `nunjucks-tag ${type === 'variable' ? 'nunjucks-variable' : ''}`,
      //     },
      //   };
      // }
        return {
          range: range,
          options: {
            inlineClassName: 'invisible-token', // Hide the braces
            afterContentClassName: 'visible-token', // Show the token
            ...(type === 'variable' && !dataError && {
              hoverMessage: {
                supportHtml: true,
                value: getVariableHoverMessage(content, value, key),
              },
            }),
            after: {
              attachedData: model.getValueInRange(range),
              content: !dataError ? content : cleanedStr,
              inlineClassName: classnames(
                'nunjucks-tag',
                {
                  'nunjucks-variable': type === 'variable',
                  'nunjucks-tag-error': dataError,
                }
              ),
              cursorStops: monaco.editor.InjectedTextCursorStops.Both,
            },
          },
        };
      }));
      // Apply the decorations
      decorationsCount.current = editor.createDecorationsCollection(decorations).length;
      // const widgets: monaco.editor.IContentWidget[] = matches.map(({ range, token, type }, idx) => {
      //   return {
      //     getDomNode: () => {
      //       const el = document.createElement('span');
      //       el.className = `nunjucks-tag ${type === 'variable' ? 'nunjucks-variable' : ''}`;
      //       el.innerHTML = token;
      //       return el;
      //     },
      //     getId: () => `${token}-{idx}`,
      //     getPosition: () => ({
      //       position: { column: range.startColumn, lineNumber: range.startLineNumber },
      //       preference: [0, 0],
      //     }),
      //   };
      //   });
      // widgets.forEach(w => editor.addContentWidget(w));
    }
  }, [handleRender, handleGetRenderContext]);

  // Function to handle content change

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

  }, [applyTokenDecorations, handleKeyDown, handleMouseUp, isEditorReady]);

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

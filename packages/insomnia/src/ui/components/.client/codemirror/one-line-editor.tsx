import './base-imports';

import classnames from 'classnames';
import clone from 'clone';
import CodeMirror, { type EditorConfiguration, type EditorEventMap } from 'codemirror';
import type { KeyCombination } from 'insomnia-data/common';
import { isMac } from 'insomnia-data/common';
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import * as reactUse from 'react-use';

import { DEBOUNCE_MILLIS } from '~/common/constants';
import * as misc from '~/common/misc';
import { type NunjucksParsedTag, type nunjucksTagContextMenuOptions } from '~/common/templating/types';
import { extractNunjucksTagFromCoords } from '~/common/templating/utils';
import { useRootLoaderData } from '~/root';
import { showModal } from '~/ui/components/modals';
import { NunjucksModal } from '~/ui/components/modals/nunjucks-modal';
import { UpgradeModal } from '~/ui/components/modals/upgrade-modal';
import { isKeyCombinationInRegistry } from '~/ui/components/settings/shortcuts';
import { useNunjucks } from '~/ui/context/nunjucks/use-nunjucks';
import { useEditorRefresh } from '~/ui/hooks/use-editor-refresh';
import { usePlanData } from '~/ui/hooks/use-plan';
import { useResizeObserver } from '~/ui/hooks/use-resize-observer';
import { plugins } from '~/ui/plugins/renderer-bridge';
import { getTagDefinitions } from '~/ui/templating/renderer-safe';

import { getCachedEditorState, setCachedEditorState } from './editor-state-cache';

// Replace the editor's entire value while PRESERVING undo/redo history and the
// cursor. Unlike cm.setValue(), which clears history, replaceRange records the
// change as a normal, undoable edit. No-ops when the value is unchanged so we
// don't push empty history entries or move the cursor needlessly.
const replaceValuePreservingHistory = (cm: CodeMirror.EditorFromTextArea, value: string) => {
  if (cm.getValue() === value) {
    return;
  }
  const cursor = cm.getCursor();
  const lastLine = cm.lastLine();
  cm.replaceRange(value, { line: 0, ch: 0 }, { line: lastLine, ch: cm.getLine(lastLine).length });
  cm.setCursor(cursor);
};

export interface OneLineEditorProps {
  defaultValue: string;
  getAutocompleteConstants?: () => string[] | PromiseLike<string[]>;
  id: string;
  onChange: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent, value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  type?: string;
  onPaste?: (text: string) => void;
  onBlur?: (e: FocusEvent) => void;
  eventListeners?: EditorEventListener<keyof EditorEventMap>[];
  // NOTE: stable key for caching/restoring undo history across remounts
  uniquenessKey?: string;
}

export interface EditorEventListener<T extends keyof EditorEventMap> {
  eventName: T;
  handler: EditorEventMap[T];
}
export interface OneLineEditorHandle {
  selectAll: () => void;
  focusEnd: () => void;
  setValue: (value: string) => void;
}
export const OneLineEditor = forwardRef<OneLineEditorHandle, OneLineEditorProps>(
  (
    {
      defaultValue,
      getAutocompleteConstants,
      id,
      onChange,
      onKeyDown,
      placeholder,
      readOnly,
      type,
      onPaste,
      onBlur,
      eventListeners,
      uniquenessKey,
    },
    ref,
  ) => {
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const codeMirror = useRef<CodeMirror.EditorFromTextArea | null>(null);
    // We need to track editor version in order to re-apply some effects when the editor is re-initialized.
    const [editorVersion, setEditorVersion] = useState(0);
    const { settings } = useRootLoaderData()!;
    const { isOwner, isEnterprisePlan } = usePlanData();
    const { handleRender, handleGetRenderContext } = useNunjucks();

    const getKeyMap = useCallback(() => {
      if (!readOnly && settings.enableKeyMapForInlineTextEditors && settings.editorKeyMap) {
        return settings.editorKeyMap;
      }
      return 'default';
    }, [settings.enableKeyMapForInlineTextEditors, settings.editorKeyMap, readOnly]);

    const initEditor = useCallback(() => {
      if (!textAreaRef.current || codeMirror.current || !editorContainerRef.current?.offsetWidth) {
        return;
      }

      const transformEnums = (tagDef: NunjucksParsedTag): NunjucksParsedTag[] => {
        if (tagDef.args[0]?.type === 'enum') {
          return (
            tagDef.args[0].options?.map(option => {
              const optionName = misc.fnOrString(option.displayName, tagDef.args);
              const newDef = clone(tagDef);
              newDef.displayName = `${tagDef.displayName} ⇒ ${optionName}`;
              newDef.args[0].defaultValue = option.value;

              return newDef;
            }) || []
          );
        }
        return [tagDef];
      };
      const canAutocomplete = !!(handleGetRenderContext || getAutocompleteConstants);
      const initialOptions: EditorConfiguration = {
        lineNumbers: false,
        placeholder: placeholder || '',
        foldGutter: false,
        autoRefresh: { delay: 2000 },
        lineWrapping: false,
        scrollbarStyle: 'null',
        lint: false,
        matchBrackets: false,
        autoCloseBrackets: false,
        viewportMargin: 30,
        readOnly: !!readOnly,
        tabindex: 0,
        selectionPointer: 'default',
        styleActiveLine: false,
        indentWithTabs: false,
        showCursorWhenSelecting: false,
        cursorScrollMargin: 12,
        // Only set keyMap if we're not read-only. This is so things like ctrl-a work on read-only mode.
        keyMap: getKeyMap(),
        extraKeys: CodeMirror.normalizeKeyMap({
          'Ctrl-Space': 'autocomplete',
          [isMac ? 'Cmd-F' : 'Ctrl-F']: () => {},
        }),
        gutters: [],
        mode: !handleRender
          ? 'text/plain'
          : {
              name: 'nunjucks',
              baseMode: 'text/plain',
            },
        environmentAutocomplete: canAutocomplete && {
          getVariables: async () => (!handleGetRenderContext ? [] : (await handleGetRenderContext())?.keys || []),
          getTags: async () => (!handleGetRenderContext ? [] : (await getTagDefinitions()).flatMap(transformEnums)),
          getConstants: getAutocompleteConstants,
          hotKeyRegistry: settings.hotKeyRegistry,
          autocompleteDelay: settings.autocompleteDelay,
        },
      };
      codeMirror.current = CodeMirror.fromTextArea(textAreaRef.current, initialOptions);
      codeMirror.current.on('beforeChange', (_: CodeMirror.Editor, change: CodeMirror.EditorChangeCancellable) => {
        const isPaste = change.text && change.text.length > 1;
        if (isPaste) {
          const startsWithCurl = change.text[0].startsWith('curl');
          const isWhitespace = change.text.join('').trim();
          if (startsWithCurl || !isWhitespace) {
            change.cancel();
            return;
          }
          // If we're in single-line mode, merge all changed lines into one
          change.update?.(change.from, change.to, [change.text.join('').replace(/\n/g, ' ')]);
        }
      });
      codeMirror.current.on('paste', (_, e: ClipboardEvent) => {
        const text = e.clipboardData?.getData('text/plain');
        // TODO: watch out for pasting urls that are curl<something>, e.g. curl.se would be picked up here without the space
        if (onPaste && text && text.startsWith('curl ')) {
          onPaste(text);
        }
      });

      codeMirror.current.on('blur', (_, e) => {
        if (onBlur) {
          onBlur(e);
        }
      });

      codeMirror.current.on('keydown', (doc: CodeMirror.Editor, event: KeyboardEvent) => {
        // Use default tab behaviour if we're told
        if (event.code === 'Tab') {
          // @ts-expect-error -- unsound property assignment
          event.codemirrorIgnore = true;
        }
        const pressedKeyComb: KeyCombination = {
          ctrl: event.ctrlKey,
          alt: event.altKey,
          shift: event.shiftKey,
          meta: event.metaKey,
          keyCode: event.keyCode,
        };
        const isUserDefinedKeyboardShortcut = isKeyCombinationInRegistry(pressedKeyComb, settings.hotKeyRegistry);
        const isAutoCompleteBinding = isKeyCombinationInRegistry(pressedKeyComb, {
          showAutocomplete: settings.hotKeyRegistry.showAutocomplete,
        });
        // Stop the editor from handling global keyboard shortcuts except for the autocomplete binding
        const isShortcutButNotAutocomplete = isUserDefinedKeyboardShortcut && !isAutoCompleteBinding;
        // Should not capture escape in order to exit modals
        const isEscapeKey = event.code === 'Escape';
        if (isShortcutButNotAutocomplete) {
          // @ts-expect-error -- unsound property assignment
          event.codemirrorIgnore = true;
          // Stop the editor from handling the escape key
        } else if (isEscapeKey) {
          // @ts-expect-error -- unsound property assignment
          event.codemirrorIgnore = true;
        } else {
          event.stopPropagation();
        }
        if (onKeyDown && !doc.isHintDropdownActive()) {
          onKeyDown(event, doc.getValue());
        }
      });
      // extra event listeners for editor
      if (Array.isArray(eventListeners) && eventListeners.length > 0) {
        eventListeners.forEach(({ eventName, handler }) => {
          codeMirror.current?.on(eventName, handler);
        });
      }
      codeMirror.current.on('blur', () =>
        codeMirror.current?.getTextArea().parentElement?.removeAttribute('data-focused'),
      );
      codeMirror.current.on('focus', () =>
        codeMirror.current?.getTextArea().parentElement?.setAttribute('data-focused', 'on'),
      );
      codeMirror.current.on('keyHandled', (_: CodeMirror.Editor, _keyName: string, event: Event) =>
        event.stopPropagation(),
      );

      // Actually set the value
      codeMirror.current?.setValue(defaultValue || '');
      // Clear history so we can't undo the initial set
      codeMirror.current?.clearHistory();
      // Restore undo/redo history saved before the previous unmount so undo
      // survives remounts (the value is re-seeded from defaultValue above, which
      // matches the persisted model value, so the restored history stays consistent)
      const cachedState = uniquenessKey ? getCachedEditorState(uniquenessKey) : undefined;
      if (cachedState?.history) {
        codeMirror.current?.setHistory(cachedState.history);
      }
      // Setup Liquid template listeners
      if (handleRender && !settings.nunjucksPowerUserMode) {
        codeMirror.current?.enableNunjucksTags(
          handleRender,
          handleGetRenderContext,
          settings.showVariableSourceAndValue,
          id,
        );
      }
      setEditorVersion(version => version + 1);
    }, [
      defaultValue,
      getAutocompleteConstants,
      handleGetRenderContext,
      handleRender,
      onBlur,
      onKeyDown,
      onPaste,
      placeholder,
      readOnly,
      settings.autocompleteDelay,
      getKeyMap,
      settings.hotKeyRegistry,
      settings.nunjucksPowerUserMode,
      settings.showVariableSourceAndValue,
      eventListeners,
      id,
      uniquenessKey,
    ]);

    const persistState = useCallback(() => {
      if (uniquenessKey && codeMirror.current) {
        setCachedEditorState(uniquenessKey, { history: codeMirror.current.getHistory() });
      }
    }, [uniquenessKey]);

    const cleanUpEditor = useCallback(() => {
      codeMirror.current?.toTextArea();
      codeMirror.current?.closeHintDropdown();
      codeMirror.current = null;
    }, []);

    useLayoutEffect(() => {
      if (editorContainerRef.current?.offsetWidth) {
        initEditor();
      }
    }, [initEditor]);

    useResizeObserver(editorContainerRef, ({ width }) => {
      if (width && width > 0) {
        initEditor();
      }
    });

    reactUse.useUnmount(() => {
      persistState();
      cleanUpEditor();
    });

    const reinitialize = useCallback(() => {
      cleanUpEditor();
      initEditor();
    }, [cleanUpEditor, initEditor]);

    useEditorRefresh(reinitialize);

    useEffect(() => {
      if (codeMirror.current) {
        // https://github.com/Kong/insomnia/issues/8265
        // we have a unique key for request panel, when connect to websocket, unique will change and component will mount again automatically
        // but when disconnect, the unique key will not change, so we need to update some configurations manually
        codeMirror.current.setOption('readOnly', readOnly);
        codeMirror.current.setOption('keyMap', getKeyMap());
      }
    }, [readOnly, getKeyMap]);

    // Re-seed the editor when the external value changes, but ONLY while the user
    // isn't actively editing (not focused) and the value actually differs. This
    // lets callers resync after an external change (sync pull, etc.) without
    // remounting via a volatile `key`, which would otherwise blur the editor and
    // drop undo history mid-edit. In-progress typing (focused) is never clobbered.
    //
    // Gated on `uniquenessKey`: it marks the editors we deliberately moved off
    // volatile-key remounting onto stable-key + in-place updates (URL bar,
    // key-value rows). Other OneLineEditor instances keep their original
    // uncontrolled-after-mount behaviour, so this stays an opt-in.
    useEffect(() => {
      const cm = codeMirror.current;
      if (cm && uniquenessKey !== undefined && !cm.hasFocus() && (defaultValue || '') !== cm.getValue()) {
        const cursor = cm.getCursor();
        cm.setValue(defaultValue || '');
        cm.setCursor(cursor);
        // value baseline changed externally, so the old history no longer applies
        cm.clearHistory();
      }
    }, [defaultValue, uniquenessKey]);

    useEffect(() => {
      // Prevent these things if we're type === "password"
      const preventDefault = (_: CodeMirror.Editor, event: Event) =>
        type?.toLowerCase() === 'password' && event.preventDefault();
      codeMirror.current?.on('copy', preventDefault);
      codeMirror.current?.on('cut', preventDefault);
      codeMirror.current?.on('dragstart', preventDefault);

      return () => {
        codeMirror.current?.off('copy', preventDefault);
        codeMirror.current?.off('cut', preventDefault);
        codeMirror.current?.off('dragstart', preventDefault);
      };
    }, [editorVersion, type]);

    useEffect(() => {
      const fn = misc.debounce((doc: CodeMirror.Editor) => {
        if (onChange) {
          onChange(doc.getValue() || '');
        }
      }, DEBOUNCE_MILLIS);
      codeMirror.current?.on('changes', fn);
      return () => codeMirror.current?.off('changes', fn);
    }, [editorVersion, onChange]);

    useEffect(() => {
      const flushOnBlur = (doc: CodeMirror.Editor) => {
        if (onChange) {
          onChange(doc.getValue() || '');
        }
      };
      codeMirror.current?.on('blur', flushOnBlur);
      return () => codeMirror.current?.off('blur', flushOnBlur);
    }, [editorVersion, onChange]);

    useEffect(() => {
      const unsubscribe = window.main.on(
        'nunjucks-context-menu-command',
        (_, { key, tag, nunjucksTag, needsEnterprisePlan, displayName }) => {
          if (id === key) {
            if (needsEnterprisePlan && !isEnterprisePlan) {
              // show modal if current user is not an enteprise user and the command is an enterprise feature
              showModal(UpgradeModal, {
                newPlan: 'enterprise',
                featureName: displayName,
                isOwner,
              });
              return;
            }
            if (nunjucksTag) {
              const { type, template, range } = nunjucksTag as nunjucksTagContextMenuOptions;
              if (type === 'edit') {
                showModal(NunjucksModal, {
                  template: template,
                  onDone: (template: string | null) => {
                    const { from, to } = range;
                    codeMirror.current?.replaceRange(template!, from, to);
                  },
                });
              } else if (type === 'delete') {
                const { from, to } = range;
                codeMirror.current?.replaceRange('', from, to);
              } else {
                return;
              }
            } else {
              codeMirror.current?.replaceSelection(tag);
            }
          }
        },
      );
      return () => {
        unsubscribe();
      };
    }, [id, isEnterprisePlan, isOwner]);

    useImperativeHandle(
      ref,
      () => ({
        selectAll: () =>
          codeMirror.current?.setSelection({ line: 0, ch: 0 }, { line: codeMirror.current.lineCount(), ch: 0 }),
        focusEnd: () => {
          if (codeMirror.current && !codeMirror.current.hasFocus()) {
            codeMirror.current.focus();
          }
          codeMirror.current?.getDoc()?.setCursor(codeMirror.current.getDoc().lineCount(), 0);
        },
        setValue: (value: string) => {
          if (codeMirror.current) {
            replaceValuePreservingHistory(codeMirror.current, value);
          }
        },
      }),
      [],
    );

    return (
      <div
        className={classnames('editor--single-line', {
          'editor': true,
          'editor--readonly': readOnly,
        })}
        data-editor-type={type || 'text'}
        data-testid="OneLineEditor"
        onContextMenu={async event => {
          if (readOnly) {
            return;
          }
          event.preventDefault();
          const pluginTemplateTags = await plugins.getTemplateTags();
          const target = event.target as HTMLElement;
          // right click on Liquid template tag
          if (target?.classList?.contains('nunjucks-tag')) {
            const { clientX, clientY } = event;
            const nunjucksTag = extractNunjucksTagFromCoords({ left: clientX, top: clientY }, codeMirror);
            if (nunjucksTag) {
              // show context menu for Liquid template tag
              window.main.showNunjucksContextMenu({ key: id, nunjucksTag, pluginTemplateTags });
            }
          } else {
            window.main.showNunjucksContextMenu({ key: id, pluginTemplateTags });
          }
        }}
      >
        <div ref={editorContainerRef} className="editor__container input editor--single-line">
          <textarea
            id={id}
            ref={textAreaRef}
            style={{ display: 'none' }}
            readOnly={readOnly}
            autoComplete="off"
            defaultValue=""
          />
        </div>
      </div>
    );
  },
);
OneLineEditor.displayName = 'OneLineEditor';

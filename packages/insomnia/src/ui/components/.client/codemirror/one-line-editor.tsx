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
import { isCurlCommand } from '~/common/utils/curl';
import { useRootLoaderData } from '~/root';
import { showModal } from '~/ui/components/modals';
import { NunjucksModal } from '~/ui/components/modals/nunjucks-modal';
import { UpgradeModal } from '~/ui/components/modals/upgrade-modal';
import { isKeyCombinationInRegistry } from '~/ui/components/settings/shortcuts';
import { Tooltip } from '~/ui/components/tooltip';
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
  historyKey?: string;
  autoFocus?: boolean;
  // Called once when the editor focuses itself due to `autoFocus`. Lets callers clear a one-shot flag.
  onAutoFocus?: () => void;
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
      historyKey,
      autoFocus,
      onAutoFocus,
    },
    ref,
  ) => {
    const editorContainerRef = useRef<HTMLDivElement>(null);
    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const codeMirror = useRef<CodeMirror.EditorFromTextArea | null>(null);
    // We need to track editor version in order to re-apply some effects when the editor is re-initialized.
    const [editorVersion, setEditorVersion] = useState(0);
    const [tooltipValue, setTooltipValue] = useState<string>(
      type?.toLowerCase() === 'password' ? '' : defaultValue || '',
    );
    const { settings } = useRootLoaderData()!;
    const { isOwner, isEnterprisePlan } = usePlanData();
    const { handleRender, handleGetRenderContext } = useNunjucks();

    // Update the tooltip value, including rendering the value of a nunjucks tag if necessary
    const updateTooltipValue = useCallback(
      async (rawValue: string) => {
        if (type?.toLowerCase() === 'password') {
          return;
        }
        if (!handleRender || !/{{|{%/.test(rawValue)) {
          setTooltipValue(rawValue);
          return;
        }
        try {
          setTooltipValue(await handleRender(rawValue));
        } catch {
          // Rendering fails when any tag in the field is invalid. Fall back to showing the raw template string that's there.
          setTooltipValue(rawValue);
        }
      },
      [handleRender, type],
    );

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
          const pastedText = change.text.join('\n');
          const hasContent = pastedText.trim();
          if (isCurlCommand(pastedText) || !hasContent) {
            change.cancel();
            return;
          }
          // If we're in single-line mode, merge all changed lines into one
          change.update?.(change.from, change.to, [change.text.join('').replace(/\n/g, ' ')]);
        }
      });
      codeMirror.current.on('paste', (_, e: ClipboardEvent) => {
        const text = e.clipboardData?.getData('text/plain');
        if (onPaste && text && isCurlCommand(text)) {
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
      updateTooltipValue(defaultValue || '');
      // Clear history so we can't undo the initial set
      codeMirror.current?.clearHistory();
      // Restore undo/redo history saved before the previous unmount so undo
      // survives remounts (the value is re-seeded from defaultValue above, which
      // matches the persisted model value, so the restored history stays consistent)
      const cachedState = historyKey ? getCachedEditorState(historyKey) : undefined;
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
      historyKey,
      updateTooltipValue,
    ]);

    const persistState = useCallback(() => {
      if (historyKey && codeMirror.current) {
        setCachedEditorState(historyKey, { history: codeMirror.current.getHistory() });
      }
    }, [historyKey]);

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

    reactUse.useMount(() => {
      initEditor();
      if (autoFocus && !readOnly) {
        onAutoFocus?.();
        // An enclosing React Aria ListBox (params/headers/environment grids) restores DOM focus to
        // the row right after we focus the editor, and a single deferred focus loses that race on
        // slower/headless machines. So we re-assert focus across a short window, re-grabbing only when
        // focus was bounced to a non-interactive element (the row) — never when the user deliberately
        // moved to another control (e.g. Tab from the URL bar to Send) — until the editor holds focus
        // or the window elapses.
        const deadline = Date.now() + 500;
        const ensureFocus = () => {
          const cm = codeMirror.current;
          if (!cm) {
            return;
          }
          if (!cm.hasFocus()) {
            const active = document.activeElement as HTMLElement | null;
            // The row React Aria bounces focus to is a non-interactive container (role="row"/"option");
            // anything genuinely interactive (a field, button, link, menu item, etc.) means the user
            // moved on purpose, so we must not steal focus back.
            const role = active?.getAttribute('role');
            const userMovedToAnotherControl =
              !!active &&
              (active.tagName === 'INPUT' ||
                active.tagName === 'TEXTAREA' ||
                active.tagName === 'SELECT' ||
                active.tagName === 'BUTTON' ||
                active.tagName === 'A' ||
                active.isContentEditable ||
                role === 'button' ||
                role === 'link' ||
                role === 'menuitem' ||
                role === 'menuitemradio' ||
                role === 'checkbox' ||
                role === 'tab');
            if (userMovedToAnotherControl) {
              return;
            }
            cm.focus();
            cm.getDoc().setCursor(cm.getDoc().lineCount(), 0);
          }
          if (Date.now() < deadline) {
            requestAnimationFrame(ensureFocus);
          }
        };
        requestAnimationFrame(ensureFocus);
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
    // Gated on `historyKey`: it marks the editors we deliberately moved off
    // volatile-key remounting onto stable-key + in-place updates (URL bar,
    // key-value rows). Other OneLineEditor instances keep their original
    // uncontrolled-after-mount behaviour, so this stays an opt-in.
    useEffect(() => {
      const cm = codeMirror.current;
      if (cm && historyKey !== undefined && !cm.hasFocus() && (defaultValue || '') !== cm.getValue()) {
        const cursor = cm.getCursor();
        cm.setValue(defaultValue || '');
        cm.setCursor(cursor);
        // value baseline changed externally, so the old history no longer applies
        cm.clearHistory();
        updateTooltipValue(defaultValue || '');
      }
    }, [defaultValue, historyKey, type, updateTooltipValue]);

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

    // Keep the latest onChange/updateTooltipValue in refs so the listener effects below
    // don't need to depend on their identity. Parents commonly pass a fresh inline closure
    // on every render, and updateTooltipValue itself is recreated whenever handleRender's
    // upstream loader data gets a new reference (e.g. on every route revalidation) - if the
    // 'changes' listener effect re-ran on either alone, it would cancel any pending debounced
    // call scheduled by keystrokes that haven't fired yet, silently dropping them.
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    const updateTooltipValueRef = useRef(updateTooltipValue);
    updateTooltipValueRef.current = updateTooltipValue;

    const debouncedChangeRef = useRef<{ cancel: () => void } | null>(null);
    useEffect(() => {
      const fn = misc.debounce((doc: CodeMirror.Editor) => {
        onChangeRef.current?.(doc.getValue() || '');
        updateTooltipValueRef.current(doc.getValue() || '');
      }, DEBOUNCE_MILLIS);
      debouncedChangeRef.current = fn;
      codeMirror.current?.on('changes', fn);
      return () => {
        fn.cancel();
        debouncedChangeRef.current = null;
        codeMirror.current?.off('changes', fn);
      };
    }, [editorVersion, type]);

    useEffect(() => {
      const flushOnBlur = (doc: CodeMirror.Editor) => {
        // Drop the pending debounced call from the 'changes' listener above - it would
        // otherwise still fire ~DEBOUNCE_MILLIS after this, calling onChange again with a
        // closure over whatever was current when the last keystroke happened. If other
        // actions (e.g. adding a new row elsewhere in the same form) landed in that window,
        // that stale call can silently clobber state newer than what it captured.
        debouncedChangeRef.current?.cancel();
        onChangeRef.current?.(doc.getValue() || '');
      };
      codeMirror.current?.on('blur', flushOnBlur);
      return () => codeMirror.current?.off('blur', flushOnBlur);
    }, [editorVersion]);

    useEffect(() => {
      const unsubscribe = window.main.on(
        'nunjucks-context-menu-command',
        (_, { key, tag, nunjucksTag, needsEnterprisePlan, displayName }) => {
          if (id === key) {
            if (needsEnterprisePlan && !isEnterprisePlan) {
              // show modal if current user is not an enterprise user and the command is an enterprise feature
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

    const isContentTruncated = () => {
      const scrollInfo = codeMirror.current?.getScrollInfo();
      if (!scrollInfo) {
        return false;
      }
      // CodeMirror's own CSS adds a fixed 30px to the scroller's width to hide the native
      // scrollbar (see the "magic margin" comment on .CodeMirror-scroll in codemirror.css).
      // scrollInfo.width always includes this extra 30px, even when the text isn't truncated
      // at all, so we must subtract it back out before comparing - otherwise every line would
      // incorrectly look truncated.
      const CODEMIRROR_SCROLLBAR_MARGIN_PX = 30;
      return scrollInfo.width > scrollInfo.clientWidth + CODEMIRROR_SCROLLBAR_MARGIN_PX;
    };

    // Nunjucks tags render their own native (rendered value + source) tooltip on hover. Showing the
    // whole-field custom tooltip on top of that would double up and only show the raw, unrendered
    // template text - so suppress the custom tooltip while the pointer is over a tag. This is tracked
    // per-pointer-position (rather than per-field) so a field mixing plain text and tags still shows
    // the full-value tooltip when hovering the text portion.
    const isPointerOverNunjucksTag = useRef(false);
    const handleEditorMouseMove = (event: React.MouseEvent) => {
      isPointerOverNunjucksTag.current = Boolean((event.target as HTMLElement)?.closest?.('[data-nunjucks-tag]'));
    };

    return (
      <Tooltip
        message={tooltipValue}
        delay={1000}
        className="h-full w-full"
        followCursor
        shouldShow={() => Boolean(tooltipValue) && !isPointerOverNunjucksTag.current && isContentTruncated()}
      >
        <div
          className={classnames('editor--single-line', {
            'editor': true,
            'editor--readonly': readOnly,
          })}
          data-editor-type={type || 'text'}
          data-testid="OneLineEditor"
          onMouseMove={handleEditorMouseMove}
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
      </Tooltip>
    );
  },
);
OneLineEditor.displayName = 'OneLineEditor';

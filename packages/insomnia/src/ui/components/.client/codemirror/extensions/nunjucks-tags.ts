import CodeMirror, { type Token } from 'codemirror';

import * as misc from '~/common/misc';
import type { HandleRender, OpenVariableSource, RenderContextAndKeys, VariableSourceMeta } from '~/common/templating/types';
import { tokenizeTag } from '~/common/templating/utils';
import { showModal } from '~/ui/components/modals/index';
import { NunjucksModal } from '~/ui/components/modals/nunjucks-modal';
import { getTagDefinitions } from '~/ui/templating/renderer-safe';

import {
  hideVariableSourceTooltip,
  scheduleHideVariableSourceTooltip,
  setHoveredVariableSourceTarget,
  showVariableSourceTooltip,
} from './variable-source-tooltip';

CodeMirror.defineExtension(
  'enableNunjucksTags',
  function (
    this: CodeMirror.Editor,
    handleRender: HandleRender,
    handleGetRenderContext: (contextCacheKey?: string) => Promise<RenderContextAndKeys>,
    showVariableSourceAndValue = false,
    editorId = '',
    onOpenVariableSource?: OpenVariableSource,
  ) {
    if (!handleRender) {
      console.warn("enableNunjucksTags wasn't passed a render function");
      return;
    }

    const refreshFn = _highlightNunjucksTags.bind(
      this,
      handleRender,
      handleGetRenderContext,
      showVariableSourceAndValue,
      editorId,
      onOpenVariableSource,
    );

    const debouncedRefreshFn = misc.debounce(refreshFn);
    this.on('change', (_cm: any, change: any) => {
      const origin = change.origin || 'unknown';

      if (!origin.match(/^[+*]/)) {
        // Refresh immediately on non-joinable events
        // (cut, paste, autocomplete; as opposed to +input, +delete)
        refreshFn();
      } else {
        // Debounce all joinable events
        debouncedRefreshFn();
      }
    });
    this.on('cursorActivity', debouncedRefreshFn);
    this.on('viewportChange', debouncedRefreshFn);
    // Trigger once right away to snappy perf
    refreshFn();
  },
);

async function _highlightNunjucksTags(
  this: CodeMirror.Editor,
  render: HandleRender,
  renderContext: (contextCacheKey?: string) => Promise<RenderContextAndKeys>,
  showVariableSourceAndValue: boolean,
  editorId: string,
  onOpenVariableSource?: OpenVariableSource,
) {
  const renderCacheKey = Math.random() + '';

  const renderString = (text: any) => render(text, renderCacheKey);
  const renderContextWithCacheKey = () => renderContext(renderCacheKey);

  // Marks (and their DOM elements with the mouseleave listeners) get rebuilt on every
  // refresh; drop any open tooltip so it cannot outlive the element it is anchored to.
  hideVariableSourceTooltip();

  const activeMarks: CodeMirror.TextMarker[] = [];
  const doc: CodeMirror.Doc = this.getDoc();

  // Only mark up Nunjucks tokens that are in the viewport
  const vp = this.getViewport();
  const readOnly = this.isReadOnly();

  for (let lineNo = vp.from; lineNo < vp.to; lineNo++) {
    const line = this.getLineTokens(lineNo);
    const tokens = line.filter(({ type }: any) => type?.indexOf('nunjucks') >= 0);

    // Aggregate same tokens
    const newTokens: Token[] = [];
    let currTok: Token | null = null;

    for (const nextTok of tokens) {
      if (currTok && currTok.type === nextTok.type && currTok.end === nextTok.start) {
        currTok.end = nextTok.end;
        currTok.string += nextTok.string;
      } else if (currTok) {
        newTokens.push(currTok);
        currTok = null;
      }

      if (!currTok) {
        currTok = Object.assign({}, nextTok);
      }
    }

    // Push the last one if we're done
    if (currTok) {
      newTokens.push(currTok);
    }

    for (const tok of newTokens) {
      const start = {
        line: lineNo,
        ch: tok.start,
      };
      const end = {
        line: lineNo,
        ch: tok.end,
      };
      const cursor = doc.getCursor();
      const isSameLine = cursor.line === lineNo;
      const isCursorInToken = isSameLine && cursor.ch > tok.start && cursor.ch < tok.end;
      const isFocused = this.hasFocus();

      // Show the token again if we're not inside of it.
      if (isFocused && isCursorInToken) {
        continue;
      }

      // See if we already have a mark for this
      let hasOwnMark = false;

      for (const mark of doc.findMarks(start, end)) {
        // Only check marks we created
        // @ts-expect-error -- TSCONVERSION need to extend nunjucks
        if (mark.__nunjucks) {
          hasOwnMark = true;
        }

        activeMarks.push(mark);
      }

      // Already have a mark for this, so leave it alone
      if (hasOwnMark) {
        continue;
      }

      const el = document.createElement('span');
      el.className = `nunjucks-tag ${tok.type}`;
      el.setAttribute('draggable', 'true');
      // Behavior hook so hover logic can detect tags without coupling to the CSS class name.
      // See handleEditorMouseMove in one-line-editor.tsx for usage.
      el.dataset.nunjucksTag = 'true';
      el.dataset.error = 'off';
      el.dataset.template = tok.string;
      el.replaceChildren(document.createElement('label'), document.createTextNode(tok.string));
      const mark = this.markText(start, end, {
        // @ts-expect-error not a known property of TextMarkerOptions
        __nunjucks: true,
        // Mark that we created it
        __template: tok.string,
        handleMouseEvents: false,
        replacedWith: el,
      });

      (async function () {
        await _updateElementText(
          renderString,
          mark,
          tok.string,
          renderContextWithCacheKey,
          showVariableSourceAndValue,
          false,
          onOpenVariableSource,
        );
      })();

      // Update it every mouseenter because it may generate a new value every time
      el.addEventListener('mouseenter', async () => {
        setHoveredVariableSourceTarget(el);
        await _updateElementText(
          renderString,
          mark,
          tok.string,
          renderContextWithCacheKey,
          showVariableSourceAndValue,
          true,
          onOpenVariableSource,
        );
      });
      el.addEventListener('mouseleave', () => {
        setHoveredVariableSourceTarget(null);
        scheduleHideVariableSourceTooltip();
      });
      activeMarks.push(mark);
      el.addEventListener('click', async () => {
        if (readOnly) return;
        // Only variables resolve to a source environment; tags do not.
        let variableSource: VariableSourceMeta | undefined;
        if (!tok.string.includes('{%')) {
          try {
            const context = await renderContextWithCacheKey();
            const cleaned = tok.string.replace(/\\/g, '').replace(/^{{/, '').replace(/}}$/, '').trim();
            variableSource = context.context.getKeysContext().keyContextMeta?.[cleaned];
          } catch {
            // Render failed; open the modal without source info.
          }
        }
        hideVariableSourceTooltip();
        // Define the dialog HTML
        showModal(NunjucksModal, {
          // @ts-expect-error not a known property of TextMarkerOptions
          template: mark.__template,
          editorId,
          variableSource,
          onOpenSource: onOpenVariableSource,
          onDone: (template: string | null) => {
            const pos = mark.find();

            if (pos) {
              const { from, to } = pos;
              // TODO: unsound non-null assertion

              this.replaceRange(template!, from, to);
            } else {
              console.warn('Tried to replace mark that did not exist', mark);
            }
          },
        });
      });
      // ~~~~~~~~~~~~~~~~~~~~~~~ //
      // Setup Drag-n-Drop stuff //
      // ~~~~~~~~~~~~~~~~~~~~~~~ //
      let droppedInSameEditor = false;

      // Modify paste events so we can merge into them
      const beforeChangeCb = (_cm: any, change: any) => {
        if (change.origin === 'paste') {
          change.origin = '+dnd';
        }
      };

      const dropCb = () => {
        droppedInSameEditor = true;
      };

      // Set up the drag
      el.addEventListener('dragstart', event => {
        // Setup the drag contents
        if (event.dataTransfer) {
          event.dataTransfer.setData('text/plain', event.target as unknown as string);
          event.dataTransfer.effectAllowed = 'copyMove';
          event.dataTransfer.dropEffect = 'move';
        }
        // Add some listeners
        this.on('beforeChange', beforeChangeCb);
        this.on('drop', dropCb);
      });
      el.addEventListener('dragend', () => {
        // If dragged within same editor, delete the old reference
        // TODO: Actually only use dropEffect for this logic. For some reason
        // changing it doesn't seem to take affect in Chromium 56 (maybe bug?)
        if (droppedInSameEditor) {
          const pos = mark.find();

          if (pos) {
            const { from, to } = pos;
            this.replaceRange('', from, to, '+dnd');
          } else {
            console.warn('Tried to remove mark that did not exist', mark);
          }
        }

        // Remove listeners we added
        this.off('beforeChange', beforeChangeCb);
        this.off('drop', dropCb);
      });
      // Don't allow dropping on itself
      el.addEventListener('drop', event => {
        event.stopPropagation();
      });
    }
  }

  // Clear all the marks that we didn't just modify/add
  // For example, adding a {% raw %} tag would need to clear everything it wrapped
  const marksInViewport = doc.findMarks(
    {
      ch: 0,
      line: vp.from,
    },
    {
      ch: 0,
      line: vp.to,
    },
  );

  for (const mark of marksInViewport) {
    // Only check marks we created
    // @ts-expect-error -- TSCONVERSION needs type extension for TextMarker for the extension
    if (!mark.__nunjucks) {
      continue;
    }

    let inActiveMarks = false;

    for (const activeMark of activeMarks) {
      // @ts-expect-error -- TSCONVERSION need to investigate in CodeMirror types
      if (activeMark.id === mark.id) {
        inActiveMarks = true;
      }
    }

    if (!inActiveMarks) {
      mark.clear();
    }
  }
}

async function _updateElementText(
  render: HandleRender,
  mark: CodeMirror.TextMarker<CodeMirror.MarkerRange>,
  text: string,
  renderContext: (contextCacheKey?: string) => Promise<RenderContextAndKeys>,
  showVariableSourceAndValue: boolean,
  isHovering = false,
  onOpenVariableSource?: OpenVariableSource,
) {
  const el = mark.replacedWith!;
  let innerHTML = text;
  let title = '';
  let dataIgnore = '';
  let dataError = '';
  const str = text.replace(/\\/g, '');
  const tagMatch = str.match(/{% *([^ ]+) *.*%}/);
  const cleanedStr = str.replace(/^{%/, '').replace(/%}$/, '').replace(/^{{/, '').replace(/}}$/, '').trim();

  try {
    if (tagMatch) {
      if (isHovering) {
        hideVariableSourceTooltip();
      }
      const tagData = tokenizeTag(str);
      const tagDefinition = (await getTagDefinitions()).find(d => d.name === tagData.name);

      if (tagDefinition) {
        // Try rendering these so we can show errors if needed
        const liveDisplayName = tagDefinition.liveDisplayName(tagData.args);
        const firstArg = tagDefinition.args[0];

        if (liveDisplayName) {
          innerHTML = liveDisplayName;
        } else if (firstArg && firstArg.type === 'enum') {
          const argData = tagData.args[0];
          // @ts-expect-error -- TSCONVERSION
          const foundOption = firstArg.options.find(d => d.value === argData.value);
          const option = foundOption || firstArg.options[0];
          innerHTML = `${tagDefinition.displayName} ⇒ ${option.displayName}`;
        } else {
          innerHTML = tagDefinition.displayName || tagData.name;
        }

        const preview = await render(text);
        title = tagDefinition.disablePreview(tagData.args) ? preview.replace(/./g, '*') : preview;
      } else {
        innerHTML = cleanedStr;
        title = 'Unrecognized tag';
        dataIgnore = 'on';
      }
    } else {
      // Render if it's a variable
      title = await render(str);
      const context = await renderContext();
      const con = context.context.getKeysContext();
      const contextForKey = con.keyContext[cleanedStr];
      const sourceMeta = con.keyContextMeta?.[cleanedStr];
      // Only suffix the title with context, if context is found
      const valueAndContext = contextForKey ? `${title} {${contextForKey}}` : title;

      // Swap what's shown in the tooltip vs the innerHTML
      if (showVariableSourceAndValue || !isHovering) {
        // Source and value are already visible inline, or this is a background
        // refresh with no hover; keep the plain native tooltip.
        innerHTML = showVariableSourceAndValue ? valueAndContext : cleanedStr;
        title = showVariableSourceAndValue ? cleanedStr : valueAndContext;
        if (isHovering) {
          hideVariableSourceTooltip();
        }
      } else {
        // The interactive tooltip shows the value and source; suppress the native title.
        // The chip keeps showing the short variable name.
        innerHTML = cleanedStr;
        showVariableSourceTooltip({
          target: el,
          value: title,
          source: sourceMeta
            ? {
                label: sourceMeta.label,
                onOpen:
                  sourceMeta.workspaceId && onOpenVariableSource
                    ? () => onOpenVariableSource(sourceMeta)
                    : undefined,
              }
            : undefined,
        });
        title = '';
      }
    }

    dataError = 'off';
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const cleanError = errorMessage.replace(/\[.+,.+]\s*/, '');
    if (isHovering && !showVariableSourceAndValue) {
      // Error chips surface the render error in the tooltip (the native title used to).
      // Hiding here instead would make the tooltip vanish instantly when moving from
      // a neighboring defined chip onto an undefined one.
      showVariableSourceTooltip({ target: el, value: cleanError });
      title = '';
    } else {
      title = cleanError;
    }
    dataError = 'on';
  }

  el.title = title;
  el.dataset.ignore = dataIgnore;

  // Rebuilding an error chip's content while the pointer is over it re-inserts the
  // warning icon, and mark.changed() re-inserts the widget node — either fires a
  // spurious mouseleave that cancels a pending tooltip. The error state (icon +
  // text) is already rendered from the previous pass, so leave the DOM untouched
  // while hovering an unchanged error chip.
  const isHoveringUnchangedErrorChip = isHovering && dataError === 'on' && el.dataset.error === 'on';

  if (dataError === 'on') {
    el.dataset.error = dataError;
    if (!isHoveringUnchangedErrorChip) {
      const label = document.createElement('label');
      const icon = document.createElement('i');
      icon.className = 'fa fa-exclamation-triangle';
      label.append(icon);
      el.replaceChildren(label, document.createTextNode(cleanedStr));
      mark.changed();
    }
  } else {
    el.replaceChildren(document.createElement('label'), document.createTextNode(innerHTML));
    mark.changed();
  }
}

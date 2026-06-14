import CodeMirror from 'codemirror';

import * as misc from '~/common/misc';
import { getTagDefinitions } from '~/templating/renderer-safe';
import type { HandleRender, RenderContextAndKeys } from '~/templating/types';
import { fieldTagLabel, tokenizeTag } from '~/templating/utils';
import { showModal } from '~/ui/components/modals/index';
import { NunjucksModal } from '~/ui/components/modals/nunjucks-modal';

import { isBlockKeyword, outermostBlockAt, pairBlockTags, scanTemplateRegions, type TagBlock } from './liquid-block-tags';

// Tags that set variables but are not block constructs themselves. When one of these
// immediately precedes a block (assign before case, for example), clicking the block
// extends the edit selection to include them so the modal has the correct variable context.
const CONTEXT_SETTER_TAGS = new Set(['assign', 'increment', 'decrement']);

CodeMirror.defineExtension(
  'enableNunjucksTags',
  function (
    this: CodeMirror.Editor,
    handleRender: HandleRender,
    handleGetRenderContext: (contextCacheKey?: string) => Promise<RenderContextAndKeys>,
    showVariableSourceAndValue = false,
    editorId = '',
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

function _isCursorInRange(
  cursor: CodeMirror.Position,
  start: CodeMirror.Position,
  end: CodeMirror.Position,
) {
  const afterStart = cursor.line > start.line || (cursor.line === start.line && cursor.ch > start.ch);
  const beforeEnd = cursor.line < end.line || (cursor.line === end.line && cursor.ch < end.ch);
  return afterStart && beforeEnd;
}

const BLOCK_LINE_CLASS = 'nunjucks-block-line';

/** Draw a connecting gutter bar across the lines spanned by each block tag. */
function _decorateBlockLines(
  cm: CodeMirror.Editor,
  doc: CodeMirror.Doc,
  vp: { from: number; to: number },
  blocks: TagBlock[],
) {
  for (let lineNo = vp.from; lineNo < vp.to; lineNo++) {
    cm.removeLineClass(lineNo, 'wrap', BLOCK_LINE_CLASS);
  }
  for (const block of blocks) {
    const fromLine = doc.posFromIndex(block.start).line;
    const toLine = doc.posFromIndex(block.end).line;
    for (let lineNo = Math.max(fromLine, vp.from); lineNo <= Math.min(toLine, vp.to - 1); lineNo++) {
      cm.addLineClass(lineNo, 'wrap', BLOCK_LINE_CLASS);
    }
  }
}

interface TagSpan {
  /** CSS suffix: 'nunjucks-variable' for `{{ }}`, otherwise 'nunjucks-tag'. */
  type: string;
  start: CodeMirror.Position;
  end: CodeMirror.Position;
  /** True if this construct is part of a paired block (`{% if %}…{% endif %}`). */
  inBlock: boolean;
}

async function _highlightNunjucksTags(
  this: CodeMirror.Editor,
  render: HandleRender,
  renderContext: (contextCacheKey?: string) => Promise<RenderContextAndKeys>,
  showVariableSourceAndValue: boolean,
  editorId: string,
) {
  const renderCacheKey = Math.random() + '';

  const renderString = (text: any) => render(text, renderCacheKey);
  const renderContextWithCacheKey = () => renderContext(renderCacheKey);

  const activeMarks: CodeMirror.TextMarker[] = [];
  const doc: CodeMirror.Doc = this.getDoc();

  // Only mark up Liquid tokens that are in the viewport
  const vp = this.getViewport();
  const readOnly = this.isReadOnly();

  // Pair block tags across the whole document so a delimiter can open its block.
  const blocks = pairBlockTags(doc.getValue());
  // Outermost block whose [start, end) contains idx — so clicking any pill inside a
  // nested structure edits the whole top-level statement, and inner pieces are flagged
  // as "in block" (and therefore not rendered in isolation).
  const blockContaining = (idx: number) => outermostBlockAt(blocks, idx);

  // Detect constructs by scanning the document text directly (rather than aggregating
  // CodeMirror's per-line tokens). This deterministically keeps a multi-line tag such
  // as `{% liquid … %}` — including blank lines inside it — as a single span.
  const text0 = doc.getValue();
  const spans: TagSpan[] = scanTemplateRegions(text0).map(region => ({
    type: region.kind === 'variable' ? 'nunjucks-variable' : 'nunjucks-tag',
    start: doc.posFromIndex(region.start),
    end: doc.posFromIndex(region.end),
    inBlock: !!blockContaining(region.start),
  }));

  for (const span of spans) {
    const { start, end } = span;
    // Only mark constructs that intersect the viewport.
    if (end.line < vp.from || start.line >= vp.to) {
      continue;
    }
    const text = doc.getRange(start, end);
    const cursor = doc.getCursor();
    const isFocused = this.hasFocus();

    // Show the raw text again if the caret is inside the span (so it's editable).
    if (isFocused && _isCursorInRange(cursor, start, end)) {
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
    el.className = `nunjucks-tag ${span.type}`;
    el.setAttribute('draggable', 'true');
    el.dataset.error = 'off';
    el.dataset.template = text;
    // Compute a synchronous initial label so the pill never flashes raw template
    // text while the async _updateElementText call is pending. This mirrors the
    // labelling logic in _updateElementText using only synchronous operations.
    const _str = text.replace(/\\/g, '');
    const _isTag = _str.trim().startsWith('{%');
    const _cleanedStr = _str.replace(/^{%-?/, '').replace(/-?%}$/, '').replace(/^{{-?/, '').replace(/-?}}$/, '').trim();
    const _syncLabel = _isTag
      ? (fieldTagLabel(_str) ?? (text.includes('\n') ? 'template → multiline' : tokenizeTag(_str).name || _cleanedStr))
      : _cleanedStr;
    el.replaceChildren(document.createElement('label'), document.createTextNode(_syncLabel));
    // Set data-ignore synchronously so block pills render grey from the first frame,
    // not the default blue that they'd briefly show before _updateElementText resolves.
    if (span.inBlock) {
      el.dataset.ignore = 'on';
    }

    const mark = this.markText(start, end, {
      // @ts-expect-error not a known property of TextMarkerOptions
      __nunjucks: true,
      // Mark that we created it
      __template: text,
      handleMouseEvents: false,
      replacedWith: el,
    });

    (async function () {
      await _updateElementText(renderString, mark, text, renderContextWithCacheKey, showVariableSourceAndValue, span.inBlock);
    })();

    // Update it every mouseenter because it may generate a new value every time
    el.addEventListener('mouseenter', async () => {
      await _updateElementText(renderString, mark, text, renderContextWithCacheKey, showVariableSourceAndValue, span.inBlock);
    });
    activeMarks.push(mark);
    el.addEventListener('click', async () => {
      if (readOnly) return;
      const pos = mark.find();
      if (!pos) {
        console.warn('Tried to replace mark that did not exist', mark);
        return;
      }
      // If this construct belongs to a block (`{% if %}…{% endif %}`), edit the whole
      // (outermost) block as one statement instead of just this delimiter/piece.
      const block = blockContaining(doc.indexFromPos(pos.from));
      let replaceFrom = block ? doc.posFromIndex(block.start) : pos.from;
      const replaceTo = block ? doc.posFromIndex(block.end) : pos.to;

      // If this pill belongs to a block, scan backwards to find standalone context-setter
      // tags (assign, increment, decrement) that appear between the previous block's end
      // and this block's start. Include them in the edit region so the modal renders the
      // block with correct variable context (e.g. `{% assign handle = "cake" %}` before
      // `{% case handle %}…{% endcase %}`).
      if (block) {
        const docText = doc.getValue();
        const freshBlocks = pairBlockTags(docText);
        const blockStartIdx = doc.indexFromPos(replaceFrom);
        const prevBlockEnd = freshBlocks
          .filter(b => b.end <= blockStartIdx)
          .reduce((max, b) => Math.max(max, b.end), 0);

        let earliestContextStart = blockStartIdx;
        for (const region of scanTemplateRegions(docText)) {
          if (region.start < prevBlockEnd) continue;
          if (region.start >= blockStartIdx) break;
          if (region.kind !== 'tag') continue;
          if (outermostBlockAt(freshBlocks, region.start)) continue;
          const name = tokenizeTag(docText.slice(region.start, region.end)).name;
          if (CONTEXT_SETTER_TAGS.has(name)) {
            earliestContextStart = Math.min(earliestContextStart, region.start);
          }
        }
        if (earliestContextStart < blockStartIdx) {
          replaceFrom = doc.posFromIndex(earliestContextStart);
        }
      }

      const template = doc.getRange(replaceFrom, replaceTo);

      showModal(NunjucksModal, {
        template,
        editorId,
        onDone: (newTemplate: string | null) => {
          if (newTemplate !== null) {
            this.replaceRange(newTemplate, replaceFrom, replaceTo);
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
        // TODO: unsound non-null assertion

        const { from, to } = mark.find()!;
        this.replaceRange('', from, to, '+dnd');
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

  _decorateBlockLines(this, doc, vp, blocks);

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
  isInBlock = false,
) {
  const el = mark.replacedWith!;
  let innerHTML = text;
  let title = '';
  let dataIgnore = '';
  let dataError = '';
  const str = text.replace(/\\/g, '');
  // A tag may span multiple lines (e.g. the `{% liquid … %}` master tag), so detect
  // by the opening delimiter rather than a single-line regex.
  const isTag = str.trim().startsWith('{%');
  // Strip delimiters, allowing for LiquidJS whitespace-control dashes (`{%-` / `-%}`).
  const cleanedStr = str
    .replace(/^{%-?/, '')
    .replace(/-?%}$/, '')
    .replace(/^{{-?/, '')
    .replace(/-?}}$/, '')
    .trim();

  // "Field" tags (assign/capture/case/decrement/echo/increment) are labelled
  // `name → variable` wherever they appear (in a block, standalone, or built-in).
  const field = isTag ? fieldTagLabel(str) : null;

  try {
    if (isInBlock) {
      // Part of a paired block (e.g. {% for %}…{% endfor %}). Rendering this piece on
      // its own would fail or be misleading (it depends on the surrounding block's
      // context), so label it and let the click handler open the whole block to edit.
      if (isTag) {
        const tagData = tokenizeTag(str);
        const tagDef = (await getTagDefinitions()).find(d => d.name === tagData.name);
        if (tagDef) {
          const firstArg = tagDef.args[0];
          if (firstArg && firstArg.type === 'enum') {
            const argData = tagData.args[0];
            // @ts-expect-error -- TSCONVERSION
            const foundOption = firstArg.options.find(d => d.value === argData?.value);
            const option = foundOption || firstArg.options[0];
            innerHTML = `${tagDef.displayName} ⇒ ${option.displayName}`;
          } else {
            innerHTML = tagDef.displayName || (field ?? tagData.name);
          }
        } else {
          innerHTML = field ?? tagData.name;
        }
      } else {
        innerHTML = cleanedStr;
      }
      title = 'Part of a block statement — click to edit the whole block';
      dataIgnore = 'on';
    } else if (isTag) {
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
      } else if (isBlockKeyword(tagData.name)) {
        // A block delimiter (e.g. {% if %}, {% else %}, {% endif %}, or a standalone
        // {% case %}/{% capture %} opener). Rendering it on its own would error
        // ("unclosed"); label it (field tags as `name → variable`) and let the click
        // handler open the whole block for editing.
        innerHTML = field ?? tagData.name;
        title = 'Part of a block statement — click to edit the whole block';
        dataIgnore = 'on';
      } else {
        // Not an Insomnia tag, but may be a valid LiquidJS built-in (e.g. liquid,
        // assign, echo). Try to render it so self-contained tags preview correctly.
        // Field tags show `name → variable`; a construct spanning multiple lines (e.g.
        // the `{% liquid … %}` master tag) is labelled "multiline"; anything else by keyword.
        const label = field ?? (text.includes('\n') ? 'template → multiline' : tagData.name || cleanedStr);
        try {
          const preview = await render(text);
          innerHTML = label;
          title = preview;
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : String(err);
          innerHTML = label;
          title = errorMessage.replace(/\[.+,.+]\s*/, '');
          dataError = 'on';
        }
      }
    } else {
      // Render if it's a variable
      title = await render(str);
      const context = await renderContext();
      const con = context.context.getKeysContext();
      const contextForKey = con.keyContext[cleanedStr];
      // Only prefix the title with context, if context is found
      const valueAndContext = contextForKey ? `{${contextForKey}}: ${title}` : title;

      // Swap what's shown in the tooltip vs the innerHTML
      innerHTML = showVariableSourceAndValue ? valueAndContext : cleanedStr;
      title = showVariableSourceAndValue ? cleanedStr : valueAndContext;
    }

    dataError = 'off';
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    title = errorMessage.replace(/\[.+,.+]\s*/, '');
    dataError = 'on';
  }

  el.title = title;
  el.dataset.ignore = dataIgnore;

  if (dataError === 'on') {
    el.dataset.error = dataError;
    const label = document.createElement('label');
    const icon = document.createElement('i');
    icon.className = 'fa fa-exclamation-triangle';
    label.append(icon);
    el.replaceChildren(label, document.createTextNode(innerHTML));
  } else {
    el.replaceChildren(document.createElement('label'), document.createTextNode(innerHTML));
  }

  mark.changed();
}

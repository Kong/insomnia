import CodeMirror, { Token } from 'codemirror';

import * as misc from '../../../../common/misc';
import { HandleGetRenderContext, HandleRender } from '../../../../common/render';
import { getTagDefinitions } from '../../../../templating/index';
import { tokenizeTag } from '../../../../templating/utils';
import { showModal } from '../../modals/index';
import { NunjucksModal } from '../../modals/nunjucks-modal';

CodeMirror.defineExtension('enableNunjucksTags', function(
  handleRender: HandleRender,
  handleGetRenderContext: HandleGetRenderContext,
  isVariableUncovered = false,
) {
  if (!handleRender) {
    console.warn("enableNunjucksTags wasn't passed a render function");
    return;
  }

  const refreshFn = _highlightNunjucksTags.bind(
    this,
    handleRender,
    handleGetRenderContext,
    isVariableUncovered,
  );

  const debouncedRefreshFn = misc.debounce(refreshFn);
  this.on('change', (_cm, change) => {
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

async function _highlightNunjucksTags(render, renderContext, isVariableUncovered) {
  const renderCacheKey = Math.random() + '';

  const renderString = text => render(text, renderCacheKey);

  const activeMarks: CodeMirror.TextMarker[] = [];
  const doc: CodeMirror.Doc = this.getDoc();

  // Only mark up Nunjucks tokens that are in the viewport
  const vp = this.getViewport();

  for (let lineNo = vp.from; lineNo < vp.to; lineNo++) {
    const line = this.getLineTokens(lineNo);
    const tokens = line.filter(({ type }) => type?.indexOf('nunjucks') >= 0);

    // Aggregate same tokens
    const newTokens: Token[] = [];
    let currTok: Token | null = null;

    for (let i = 0; i < tokens.length; i++) {
      const nextTok = tokens[i];

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
      el.setAttribute('data-error', 'off');
      el.setAttribute('data-template', tok.string);
      const mark = this.markText(start, end, {
        __nunjucks: true,
        // Mark that we created it
        __template: tok.string,
        handleMouseEvents: false,
        replacedWith: el,
      });

      (async function() {
        await _updateElementText(
          renderString,
          mark,
          tok.string,
          renderContext,
          isVariableUncovered,
        );
      })();

      // Update it every mouseenter because it may generate a new value every time
      el.addEventListener('mouseenter', async () => {
        await _updateElementText(
          renderString,
          mark,
          tok.string,
          renderContext,
          isVariableUncovered,
        );
      });
      activeMarks.push(mark);
      el.addEventListener('click', async () => {
        // Define the dialog HTML
        showModal(NunjucksModal, {
          template: mark.__template,
          onDone: template => {
            const pos = mark.find();

            if (pos) {
              const { from, to } = pos;
              this.replaceRange(template, from, to);
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
      const beforeChangeCb = (_cm, change) => {
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
          const template = (event.target as typeof el)?.getAttribute('data-template') || '';
          event.dataTransfer.setData('text/plain', template);
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
          const { from, to } = mark.find();
          this.replaceRange('', from, to, '+dnd');
        }

        // Remove listeners we added
        this.off('beforeChange', beforeChangeCb);
        this.off('drop', dropCb);
      });
      // Don't allow dropping on itself
      el.addEventListener('drop', e => {
        e.stopPropagation();
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

async function _updateElementText(render, mark, text, renderContext, isVariableUncovered) {
  const el = mark.replacedWith;
  let innerHTML = '';
  let title = '';
  let dataIgnore = '';
  let dataError = '';
  const str = text.replace(/\\/g, '');
  const tagMatch = str.match(/{% *([^ ]+) *.*%}/);
  const cleanedStr = str
    .replace(/^{%/, '')
    .replace(/%}$/, '')
    .replace(/^{{/, '')
    .replace(/}}$/, '')
    .trim();

  try {
    if (tagMatch) {
      const tagData = tokenizeTag(str);
      const tagDefinition = (await getTagDefinitions()).find(d => d.name === tagData.name);

      if (tagDefinition) {
        // Try rendering these so we can show errors if needed
        // @ts-expect-error -- TSCONVERSION
        const liveDisplayName = tagDefinition.liveDisplayName(tagData.args);
        const firstArg = tagDefinition.args[0];

        if (liveDisplayName) {
          innerHTML = liveDisplayName;
        } else if (firstArg && firstArg.type === 'enum') {
          const argData = tagData.args[0];
          // @ts-expect-error -- TSCONVERSION
          const foundOption = firstArg.options.find(d => d.value === argData.value);
          // @ts-expect-error -- TSCONVERSION
          const option = foundOption || firstArg.options[0];
          innerHTML = `${tagDefinition.displayName} &rArr; ${option.displayName}`;
        } else {
          innerHTML = tagDefinition.displayName || tagData.name;
        }

        const preview = await render(text);
        // @ts-expect-error -- TSCONVERSION
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
      // Only prefix the title with context, if context is found
      title = contextForKey ? `{${contextForKey}}: ${title}` : title;
      innerHTML = isVariableUncovered ? title : cleanedStr;
    }

    dataError = 'off';
  } catch (err) {
    title = err.message.replace(/\[.+,.+]\s*/, '');
    dataError = 'on';
  }

  el.title = title;
  el.setAttribute('data-ignore', dataIgnore);

  if (dataError === 'on') {
    el.setAttribute('data-error', dataError);
    el.innerHTML = '<label><i class="fa fa-exclamation-triangle"></i></label>' + cleanedStr;
  } else {
    el.innerHTML = '<label></label>' + innerHTML;
  }

  mark.changed();
}

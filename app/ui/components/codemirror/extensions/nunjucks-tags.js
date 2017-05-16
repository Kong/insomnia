import CodeMirror from 'codemirror';
import * as misc from '../../../../common/misc';
import NunjucksVariableModal from '../../modals/nunjucks-modal';
import {showModal} from '../../modals/index';

CodeMirror.defineExtension('enableNunjucksTags', function (handleRender) {
  if (!handleRender) {
    console.warn('enableNunjucksTags wasn\'t passed a render function');
    return;
  }

  const refreshFn = _highlightNunjucksTags.bind(this, handleRender);
  const debouncedRefreshFn = misc.debounce(refreshFn);

  this.on('change', (cm, change) => {
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
});

async function _highlightNunjucksTags (render) {
  const renderCacheKey = Math.random() + '';
  const renderString = text => render(text, renderCacheKey);

  const activeMarks = [];
  const doc = this.getDoc();

  // Only mark up Nunjucks tokens that are in the viewport
  const vp = this.getViewport();
  for (let lineNo = vp.from; lineNo < vp.to; lineNo++) {
    const line = this.getLineTokens(lineNo);
    const tokens = line.filter(({type}) => type && type.indexOf('nunjucks') >= 0);

    // Aggregate same tokens
    const newTokens = [];
    let currTok = null;
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
      const start = {line: lineNo, ch: tok.start};
      const end = {line: lineNo, ch: tok.end};
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
      for (const m of doc.findMarks(start, end)) {
        // Only check marks we created
        if (m.__nunjucks) {
          hasOwnMark = true;
        }

        activeMarks.push(m);
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
        __nunjucks: true, // Mark that we created it
        __template: tok.string,
        handleMouseEvents: false,
        replacedWith: el
      });

      (async function () {
        await _updateElementText(renderString, mark, tok.string);
      })();

      activeMarks.push(mark);

      el.addEventListener('click', async () => {
        // Define the dialog HTML
        showModal(NunjucksVariableModal, {
          template: mark.__template,
          onDone: template => {
            const pos = mark.find();
            if (pos) {
              const {from, to} = pos;
              this.replaceRange(template, from, to);
            } else {
              console.warn('Tried to replace mark that did not exist', mark);
            }
          }
        });
      });

      // ~~~~~~~~~~~~~~~~~~~~~~~ //
      // Setup Drag-n-Drop stuff //
      // ~~~~~~~~~~~~~~~~~~~~~~~ //

      let droppedInSameEditor = false;

      // Modify paste events so we can merge into them
      const beforeChangeCb = (cm, change) => {
        if (change.origin === 'paste') {
          change.origin = '+dnd';
        }
      };

      const dropCb = (cm, e) => {
        droppedInSameEditor = true;
      };

      // Set up the drag
      el.addEventListener('dragstart', e => {
        // Setup the drag contents
        const template = e.target.getAttribute('data-template');
        e.dataTransfer.setData('text/plain', template);
        e.dataTransfer.effectAllowed = 'copyMove';
        e.dataTransfer.dropEffect = 'move';

        // Add some listeners
        this.on('beforeChange', beforeChangeCb);
        this.on('drop', dropCb);
      });

      el.addEventListener('dragend', e => {
        // If dragged within same editor, delete the old reference
        // TODO: Actually only use dropEffect for this logic. For some reason
        // changing it doesn't seem to take affect in Chromium 56 (maybe bug?)
        if (droppedInSameEditor) {
          const {from, to} = mark.find();
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
    {ch: 0, line: vp.from},
    {ch: 0, line: vp.to},
  );

  for (const mark of marksInViewport) {
    // Only check marks we created
    if (!mark.__nunjucks) {
      continue;
    }

    let inActiveMarks = false;
    for (const activeMark of activeMarks) {
      if (activeMark.id === mark.id) {
        inActiveMarks = true;
      }
    }

    if (!inActiveMarks) {
      mark.clear();
    }
  }
}

async function _updateElementText (render, mark, text) {
  const el = mark.replacedWith;

  try {
    const str = text.replace(/\\/g, '');
    const tagMatch = str.match(/{% *([^ ]+) *.*%}/);
    const cleanedStr = str
      .replace(/^{%/, '')
      .replace(/%}$/, '')
      .replace(/^{{/, '')
      .replace(/}}$/, '')
      .trim();

    if (tagMatch) {
      const tag = tagMatch[1];

      // Don't render other tags because they may be two-parters
      // eg. {% for %}...{% endfor %}
      const cleaned = cleanedStr.replace(tag, '').trim();
      const short = cleaned.length > 20 ? `${cleaned.slice(0, 20)}&hellip;` : cleaned;
      el.innerHTML = `<label>${tag}</label> ${short}`.trim();

      if (['response', 'res', 'uuid', 'timestamp', 'now', 'base64'].includes(tag)) {
        // Try rendering these so we can show errors if needed
        el.title = await render(str);
      } else {
        el.setAttribute('data-ignore', 'on');
      }
    } else {
      // Render if it's a variable
      el.innerHTML = `<label></label>${cleanedStr}`.trim();
      el.title = await render(str);
    }
    el.setAttribute('data-error', 'off');
    mark.changed();
  } catch (err) {
    const fullMessage = err.message.replace(/\[.+,.+]\s*/, '');
    let message = fullMessage;
    const label = el.querySelector('label');
    label.innerHTML = `<i class="fa fa-exclamation-triangle"></i>${label.innerHTML}`;
    el.title = message;
    el.setAttribute('data-error', 'on');
    mark.changed();
  }
}

import CodeMirror from 'codemirror';
import * as misc from '../../../../common/misc';

CodeMirror.defineExtension('enableNunjucksTags', function (handleRender) {
  if (!handleRender) {
    return;
  }

  const refreshFn = _highlightNunjucksTags.bind(this, handleRender);
  const debouncedRefreshFn = misc.debounce(refreshFn);

  this.on('changes', debouncedRefreshFn);
  this.on('cursorActivity', debouncedRefreshFn);
  this.on('viewportChange', debouncedRefreshFn);
});

async function _highlightNunjucksTags (render) {
  const renderCacheKey = Math.random() + '';
  const renderString = text => render(text, true, renderCacheKey);

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
      const existingMarks = doc.findMarks(start, end);
      if (existingMarks.length) {
        existingMarks.map(m => activeMarks.push(m));
        continue;
      }

      const element = document.createElement('span');

      element.className = `nunjucks-widget ${tok.type}`;
      element.setAttribute('data-active', 'off');
      element.setAttribute('data-error', 'off');

      await _updateElementText(renderString, element, tok.string);

      const mark = this.markText(start, end, {
        handleMouseEvents: false,
        replacedWith: element,
      });

      activeMarks.push(mark);

      element.addEventListener('click', () => {
        element.setAttribute('data-active', 'on');

        // Define the dialog HTML
        const html = [
          '<div class="wide hide-scrollbars scrollable">',
          '<input type="text" name="template"/>',
          element.title ?
            `<span class="result">${element.title}</span>` :
            '<span class="result super-faint italic">n/a</span>',
          '</div>',
        ].join(' ');

        const dialogOptions = {
          __dirty: false,
          value: tok.string,
          selectValueOnOpen: true,
          closeOnEnter: true,
          async onClose () {
            element.removeAttribute('data-active');

            // Revert string back to original if it's changed
            if (this.__dirty) {
              await _updateElementText(renderString, element, tok.string);
              mark.changed();
            }
          },
          async onInput (e, text) {
            this.__dirty = true;

            clearTimeout(this.__timeout);
            this.__timeout = setTimeout(async () => {
              const el = e.target.parentNode.querySelector('.result');
              await _updateElementText(renderString, el, text, true);
            }, 600);
          }
        };

        this.openDialog(html, text => {
          // Replace the text with the newly edited stuff
          const {from, to} = mark.find();
          this.replaceRange(text, from, to);

          // Clear the marker so it doesn't mess us up later on.
          mark.clear();
        }, dialogOptions);
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
    if (!activeMarks.find(m => m.id === mark.id)) {
      mark.clear();
    }
  }
}

async function _updateElementText (render, el, text, preview = false) {
  try {
    const str = text.replace(/\\/g, '');
    const tagMatch = str.match(/{% *([^ ]+) *.*%}/);
    const cleanedStr = str
      .replace(/^{%/, '')
      .replace(/%}$/, '')
      .replace(/^{{/, '')
      .replace(/}}$/, '')
      .trim();

    let innerHTML = '';

    if (tagMatch) {
      const tag = tagMatch[1];

      // Don't render other tags because they may be two-parters
      // eg. {% for %}...{% endfor %}
      const cleaned = cleanedStr.replace(tag, '').trim();
      innerHTML = `<label>${tag}</label> ${cleaned}`.trim();

      if (['response', 'res', 'uuid', 'timestamp', 'now'].includes(tag)) {
        // Try rendering these so we can show errors if needed
        const v = await render(str);
        el.title = v;
        innerHTML = preview ? v : innerHTML;
      } else {
        el.setAttribute('data-ignore', 'on');
      }
    } else {
      // Render if it's a variable
      const v = await render(str);
      el.title = v;
      innerHTML = preview ? v : `${cleanedStr}`.trim();
    }

    el.innerHTML = innerHTML;
    el.setAttribute('data-error', 'off');
  } catch (err) {
    const fullMessage = err.message.replace(/\[.+,.+]\s*/, '');
    let message = fullMessage;
    if (message.length > 30) {
      message = `${message.slice(0, 27)}&hellip;`
    }
    el.innerHTML = `&#x203c; ${message}`;
    el.className += ' nunjucks-widget--error';
    el.setAttribute('data-error', 'on');
    el.title = fullMessage;
  }
}


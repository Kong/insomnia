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

  this.on('changes', debouncedRefreshFn);
  this.on('cursorActivity', debouncedRefreshFn);
  this.on('viewportChange', debouncedRefreshFn);

  // Trigger once right away to snappy perf
  refreshFn();
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

      const element = document.createElement('span');

      element.className = `nunjucks-widget ${tok.type}`;
      element.setAttribute('data-error', 'off');

      await _updateElementText(renderString, element, tok.string);

      const mark = this.markText(start, end, {
        __nunjucks: true, // Mark that we created it
        __template: tok.string,
        handleMouseEvents: false,
        replacedWith: element
      });

      activeMarks.push(mark);

      element.addEventListener('click', async () => {
        // Define the dialog HTML
        showModal(NunjucksVariableModal, {
          template: mark.__template,
          onDone: template => {
            const {from, to} = mark.find();
            this.replaceRange(template, from, to);
          }
        });
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

async function _updateElementText (render, el, text) {
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
      el.innerHTML = `<label>${tag}</label> ${cleaned}`.trim();

      if (['response', 'res', 'uuid', 'timestamp', 'now'].includes(tag)) {
        // Try rendering these so we can show errors if needed
        const v = await render(str);
        el.title = v;
      } else {
        el.setAttribute('data-ignore', 'on');
      }
    } else {
      // Render if it's a variable
      el.innerHTML = `<label>var</label> ${cleanedStr}`.trim();
      const v = await render(str);
      el.title = v;
    }

    el.setAttribute('data-error', 'off');
  } catch (err) {
    const fullMessage = err.message.replace(/\[.+,.+]\s*/, '');
    let message = fullMessage;
    el.title = message;
    el.className += ' nunjucks-widget--error';
    el.setAttribute('data-error', 'on');
  }
}

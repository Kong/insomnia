// Mode name is intentionally kept as 'nunjucks' for back-compat with all editor instantiations;
// the underlying template engine is LiquidJS.
import CodeMirror from 'codemirror';

export function isNunjucksMode(
  mode: CodeMirror.ModeSpec<unknown>,
): mode is CodeMirror.ModeSpec<{ baseMode: 'string' }> {
  return 'baseMode' in mode;
}

CodeMirror.defineMode('nunjucks', (config, parserConfig) => {
  const baseMode = CodeMirror.getMode(config, parserConfig.baseMode || 'text/plain');

  const nunjucksMode = _nunjucksMode();

  return CodeMirror.overlayMode(baseMode, nunjucksMode, false);
});

function _nunjucksMode() {
  // Complete (single-line) constructs. The optional `-?` after the opening
  // delimiter matches LiquidJS whitespace-control delimiters (`{%-`, `{{-`, `{#-`);
  // the trailing `-%}` / `-}}` / `-#}` are consumed by the existing inner classes.
  const regexVariable = /^{{-?\s*([^ }]+)\s*[^}]*\s*}}/;
  const regexTag = /^{%-?\s*([^ }]+)\s*[^%]*\s*%}/;
  const regexComment = /^{#-?\s*[^#]+\s*#}/;
  // Opening delimiters, used when a construct is not closed on the same line
  // (e.g. the multi-line LiquidJS `{% liquid … %}` master tag, or a `{% if … %}`
  // whose expression wraps across lines).
  const openVariable = /^{{/;
  const openTag = /^{%/;
  const openComment = /^{#/;
  // Consume from the current position up to and including the closing delimiter.
  const closeVariable = /^[\s\S]*?}}/;
  const closeTag = /^[\s\S]*?%}/;
  const closeComment = /^[\s\S]*?#}/;
  // Flipped on every new construct so adjacent constructs get distinct token
  // types. A single multi-line construct keeps one ticker (`state.tagTicker`)
  // across all of its lines so the marker extension can stitch it into one pill.
  let ticker = 1;

  return {
    startState() {
      return {
        inRaw: false,
        inTag: false,
        inVariable: false,
        inComment: false,
        tagTicker: 1,
      };
    },

    token(stream: any, state: any) {
      // Continue a multi-line construct opened on a previous line.
      if (state.inTag) {
        if (stream.match(closeTag, true)) {
          state.inTag = false;
        } else {
          stream.skipToEnd();
        }
        return state.inRaw ? null : `nunjucks-tag ${state.tagTicker}`;
      }
      if (state.inVariable) {
        if (stream.match(closeVariable, true)) {
          state.inVariable = false;
        } else {
          stream.skipToEnd();
        }
        return `nunjucks-variable ${state.tagTicker}`;
      }
      if (state.inComment) {
        if (stream.match(closeComment, true)) {
          state.inComment = false;
        } else {
          stream.skipToEnd();
        }
        return `nunjucks-comment ${state.tagTicker}`;
      }

      // Inside a `{% raw %}` block only `{% endraw %}` is meaningful; everything
      // else (including `{{ }}`) is literal text.
      if (state.inRaw) {
        const m = stream.match(regexTag, true);
        if (m) {
          ticker *= -1;
          if (m[1] === 'endraw') {
            state.inRaw = false;
            state.tagTicker = ticker;
            return `nunjucks-tag ${ticker}`;
          }
          // Some other tag inside raw — render it as literal text.
          return null;
        }
        while (stream.next() != null) {
          if (stream.match(regexTag, false)) {
            break;
          }
        }
        return null;
      }

      // Complete single-line tag.
      let m = stream.match(regexTag, true);
      if (m) {
        ticker *= -1;
        state.tagTicker = ticker;
        if (m[1] === 'raw') {
          state.inRaw = true;
        }
        return `nunjucks-tag ${ticker}`;
      }
      // Tag opener with no `%}` on this line → multi-line tag.
      if (stream.match(openTag, true)) {
        ticker *= -1;
        state.tagTicker = ticker;
        if (stream.match(closeTag, true)) {
          // Closed later on the same line (the strict regex can miss e.g. a
          // modulo `%` in the expression); treat as a normal single-line tag.
          return `nunjucks-tag ${ticker}`;
        }
        state.inTag = true;
        stream.skipToEnd();
        return `nunjucks-tag ${ticker}`;
      }

      // Complete single-line variable.
      m = stream.match(regexVariable, true);
      if (m) {
        ticker *= -1;
        state.tagTicker = ticker;
        return `nunjucks-variable ${ticker}`;
      }
      // Variable opener with no `}}` on this line → multi-line variable.
      if (stream.match(openVariable, true)) {
        ticker *= -1;
        state.tagTicker = ticker;
        if (stream.match(closeVariable, true)) {
          return `nunjucks-variable ${ticker}`;
        }
        state.inVariable = true;
        stream.skipToEnd();
        return `nunjucks-variable ${ticker}`;
      }

      // Complete single-line comment.
      m = stream.match(regexComment, true);
      if (m) {
        ticker *= -1;
        state.tagTicker = ticker;
        return `nunjucks-comment ${ticker}`;
      }
      // Comment opener with no `#}` on this line → multi-line comment.
      if (stream.match(openComment, true)) {
        ticker *= -1;
        state.tagTicker = ticker;
        if (stream.match(closeComment, true)) {
          return `nunjucks-comment ${ticker}`;
        }
        state.inComment = true;
        stream.skipToEnd();
        return `nunjucks-comment ${ticker}`;
      }

      // Advance to the next delimiter.
      while (stream.next() != null) {
        if (
          stream.match(openTag, false) ||
          stream.match(openVariable, false) ||
          stream.match(openComment, false)
        ) {
          break;
        }
      }

      return null;
    },
  };
}

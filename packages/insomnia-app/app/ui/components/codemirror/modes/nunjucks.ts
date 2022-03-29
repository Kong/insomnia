import CodeMirror from 'codemirror';

export function isNunjucksMode(
  mode: CodeMirror.ModeSpec<unknown>
): mode is CodeMirror.ModeSpec<{ baseMode: 'string' }> {
  return 'baseMode' in mode;
}

CodeMirror.defineMode('nunjucks', (config, parserConfig) => {
  const baseMode = CodeMirror.getMode(config, parserConfig.baseMode || 'text/plain');

  const nunjucksMode = _nunjucksMode();

  return CodeMirror.overlayMode(baseMode, nunjucksMode, false);
});

function _nunjucksMode() {
  const regexVariable = /^{{\s*([^ }]+)\s*[^}]*\s*}}/;
  const regexTag = /^{%\s*([^ }]+)\s*[^%]*\s*%}/;
  const regexComment = /^{#\s*[^#]+\s*#}/;
  let ticker = 1;
  return {
    startState() {
      return {
        inRaw: false,
      };
    },

    token(stream, state) {
      let m;
      // This makes sure that adjacent tags still have unique types
      ticker *= -1;
      m = stream.match(regexTag, true);

      if (m) {
        const name = m[1];

        if (state.inRaw && name === 'endraw') {
          state.inRaw = false;
        } else if (!state.inRaw && name === 'raw') {
          state.inRaw = true;
        } else if (state.inRaw) {
          // Inside raw tag so do nothing
          return null;
        }

        return `nunjucks-tag ${ticker}`;
      }

      if (!state.inRaw) {
        m = stream.match(regexVariable, true);

        if (m) {
          return `nunjucks-variable ${ticker}`;
        }
      }

      if (!state.inRaw) {
        m = stream.match(regexComment, true);

        if (m) {
          return `nunjucks-comment ${ticker}`;
        }
      }

      while (stream.next() != null) {
        if (stream.match(regexVariable, false)) break;
        if (stream.match(regexTag, false)) break;
        if (stream.match(regexComment, false)) break;
      }

      return null;
    },
  };
}

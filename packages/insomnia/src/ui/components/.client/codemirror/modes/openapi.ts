import CodeMirror from 'codemirror';

CodeMirror.defineMode('openapi', function () {
  const cons = ['true', 'false', 'on', 'off', 'yes', 'no'];
  const keywordRegex = new RegExp(String.raw`\b((` + cons.join(')|(') + '))$', 'i');
  return {
    token: function (stream, state) {
      const ch = stream.peek();
      const esc = state.escaped;
      state.escaped = false;

      /* comments */
      if (ch === '#' && (stream.pos === 0 || /\s/.test(stream.string.charAt(stream.pos - 1)))) {
        stream.skipToEnd();
        return 'comment';
      }

      if (/^('([^']|\\.)*'?|"([^"]|\\.)*"?)/.test(stream)) {
        return 'string';
      }

      if (state.literal && stream.indentation() > state.keyCol) {
        stream.skipToEnd();
        return 'string';
      } else if (state.literal) {
        state.literal = false;
      }

      if (stream.sol()) {
        state.keyCol = 0;
        state.pair = false;
        state.pairStart = false;

        /* document start */
        if (/---/.test(stream)) {
          return 'def';
        }

        /* document end */
        if (/\.\.\./.test(stream)) {
          return 'def';
        }

        /* array list item */
        if (/\s*-\s+/.test(stream)) {
          return 'meta';
        }
      }

      /* inline pairs/lists */
      if (/^(\{|\}|\[|\])/.test(stream)) {
        switch (ch) {
        case '{': {
          state.inlinePairs++;
        
        break;
        }
        case '}': {
          state.inlinePairs--;
        
        break;
        }
        case '[': {
          state.inlineList++;
        
        break;
        }
        default: {
          state.inlineList--;
        }
        }

        return 'meta';
      }

      /* list separator */
      if (state.inlineList > 0 && !esc && ch === ',') {
        stream.next();
        return 'meta';
      }

      /* pairs separator */
      if (state.inlinePairs > 0 && !esc && ch === ',') {
        state.keyCol = 0;
        state.pair = false;
        state.pairStart = false;
        stream.next();
        return 'meta';
      }

      /* start of value of a pair */
      if (state.pairStart) {
        /* block literals */
        if (/^\s*(\||>)\s*/.test(stream)) {
          state.literal = true;
          return 'meta';
        }

        /* references */
        if (/^\s*(&|\*)[a-z0-9._-]+\b/i.test(stream)) {
          return 'variable-2';
        }

        /* numbers */
        if (state.inlinePairs === 0 && /^\s*-?[0-9.,]+\s?$/.test(stream)) {
          return 'number';
        }

        if (state.inlinePairs > 0 && /^\s*-?[0-9.,]+\s?(?=(,|}))/.test(stream)) {
          return 'number';
        }

        /* keywords */
        if (keywordRegex.test(stream)) {
          return 'keyword';
        }
      }

      /* pairs (associative arrays) -> key */
      if (!state.pair && /^\s*(?:[,[\]{}&*!|>'"%@`][^\s'":]|[^,[\]{}#&*!|>'"%@`])[^#]*?(?=\s*:($|\s))/.test(stream)) {
        state.pair = true;
        state.keyCol = stream.indentation();
        return 'atom';
      }

      if (state.pair && /^:\s*/.test(stream)) {
        state.pairStart = true;
        return 'meta';
      }

      /* nothing found, continue */
      state.pairStart = false;
      state.escaped = ch === '\\';
      stream.next();
      return null;
    },
    startState: function () {
      return {
        pair: false,
        pairStart: false,
        keyCol: 0,
        inlinePairs: 0,
        inlineList: 0,
        literal: false,
        escaped: false,
      };
    },
    lineComment: '#',
    fold: 'indent',
  };
});
CodeMirror.defineMIME('text/x-openapi', 'openapi');
CodeMirror.defineMIME('text/openapi', 'openapi');

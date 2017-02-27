import CodeMirror from 'codemirror';

CodeMirror.defineMode('nunjucks', (config, parserConfig) => {
  const baseMode = CodeMirror.getMode(config, parserConfig.baseMode || 'text/plain');
  const nunjucksMode = _nunjucksMode();
  return CodeMirror.overlayMode(baseMode, nunjucksMode, false);
});

function _nunjucksMode () {
  const regexVariable = /^{{[^}]+}}/;
  const regexTag = /^{%[^%]+%}/;
  const regexComment = /^{#[^#]+#}/;

  return {
    token: function (stream, state) {
      if (stream.match(regexVariable, true)) {
        return 'nunjucks nunjucks-variable';
      }

      if (stream.match(regexTag, true)) {
        return 'nunjucks nunjucks-tag';
      }

      if (stream.match(regexComment, true)) {
        return 'nunjucks nunjucks-comment';
      }

      while (stream.next() != null) {
        if (stream.match(regexVariable, false)) break;
        if (stream.match(regexTag, false)) break;
        if (stream.match(regexComment, false)) break;
      }

      return null;
    }
  }
}

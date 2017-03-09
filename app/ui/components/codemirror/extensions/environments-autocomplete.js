import CodeMirror from 'codemirror';
import 'codemirror/addon/mode/overlay';

CodeMirror.defineOption('environmentAutocomplete', null, (cm, options) => {
  if (!options) {
    return;
  }

  function completeAfter (cm, fn) {
    if (!fn || fn()) {
      setTimeout(() => {
        if (!cm.state.completionActive) {
          cm.showHint({
            hint: showHint,
            completeSingle: false,
            getContext: options.getContext
          });
        }
      }, 100);
    }

    return CodeMirror.Pass;
  }

  function completeIfAfterSingleBracket (cm) {
    return completeAfter(cm, () => {
      const cur = cm.getCursor();
      const pos = CodeMirror.Pos(cur.line, cur.ch - 2);
      const range = cm.getRange(pos, cur);
      return range.match(/^[^{]{$/);
    });
  }

  function completeIfAfterDoubleBrackets (cm) {
    return completeAfter(cm, () => {
      const cur = cm.getCursor();
      const pos = CodeMirror.Pos(cur.line, cur.ch - 3);
      const range = cm.getRange(pos, cur);
      return range.match(/^[^{]{{$/);
    });
  }

  cm.addKeyMap({
    "'{'": completeIfAfterSingleBracket,
    "' '": completeIfAfterDoubleBrackets,
    'Ctrl-Space': 'autocomplete'
  });
});

async function showHint (cm, options) {
  const ctx = await options.getContext();

  const cur = cm.getCursor();
  const pos = CodeMirror.Pos(cur.line, cur.ch - 100);
  const range = cm.getRange(pos, cur);
  const match = range.match(/{{\s*(\w*)$/);
  const nameSection = match ? match[1] : '';

  const list = ctx.keys
    .filter(k => k.indexOf(nameSection) >= 0)
    .map(k => ({
      text: k,
      displayText: k
      // hint: (cm, self, data) => {
      //   console.log('HINT', cm, self, data);
      //   cm.replaceRange(data.text, self.from, self.to);
      // }
    }));

  const from = CodeMirror.Pos(cur.line, cur.ch - nameSection.length);
  const to = CodeMirror.Pos(cur.line, cur.ch);
  return {list, from, to};
}

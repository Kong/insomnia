import CodeMirror from 'codemirror';
import 'codemirror/addon/mode/overlay';

const MAX_HINT_LOOK_BACK = 100;
const HINT_DELAY_MILLIS = 100;

CodeMirror.defineOption('environmentAutocomplete', null, (cm, options) => {
  if (!options) {
    return;
  }

  function completeAfter (cm, fn) {
    if (!fn || fn()) {
      setTimeout(() => {
        if (!cm.state.completionActive) {
          const {getContext} = options;
          cm.showHint({hint, completeSingle: false, getContext});
        }
      }, HINT_DELAY_MILLIS);
    }

    return CodeMirror.Pass;
  }

  function completeIfInsideDoubleBrackets (cm) {
    return completeAfter(cm, () => {
      const cur = cm.getCursor();
      const pos = CodeMirror.Pos(cur.line, cur.ch - MAX_HINT_LOOK_BACK);
      const range = cm.getRange(pos, cur);
      return range.match(/^[^{]+\{\{[^}]*/);
    });
  }

  // Add hot key triggers
  cm.addKeyMap({'Ctrl-Space': 'autocomplete'});
  cm.on('keydown', (cm, e) => {
    // Only operate on one-letter keys. This will filter out
    // any special keys (Backspace, Enter, etc)
    if (e.key.length > 1) {
      return;
    }

    completeIfInsideDoubleBrackets(cm);
  });
});

/**
 * Function to retrieve the list items
 * @param cm
 * @param options
 * @returns {Promise.<{list: Array, from, to}>}
 */
async function hint (cm, options) {
  // Get the text from the cursor back
  const cur = cm.getCursor();
  const pos = CodeMirror.Pos(cur.line, cur.ch - MAX_HINT_LOOK_BACK);
  const previousText = cm.getRange(pos, cur);

  // See if we're completing a variable name
  const variableNameMatch = previousText.match(/{{\s*([\w.\][]*)$/);
  const variableNameSegment = variableNameMatch ? variableNameMatch[1] : '__does_not_exist__';

  // See if we're completing a filter name
  const filterNameMatch = previousText.match(/{{\s*\w*\s*\|\s*(\w*)$/);
  const filterNameSegment = filterNameMatch ? filterNameMatch[1] : '__does_not_exist__';

  const stringsToMatch = variableNameMatch
    ? (await options.getContext()).keys
    : ['upper', 'lower', 'title'];

  const matchedSegment = variableNameMatch
    ? variableNameSegment
    : filterNameSegment;

  // Actually try to match the list of things
  const list = stringsToMatch
    .filter(k => k.indexOf(matchedSegment) >= 0)
    .map(k => ({
      text: k,
      displayText: k,
      hint: replaceHintMatch
    }));

  const from = CodeMirror.Pos(cur.line, cur.ch - matchedSegment.length);
  const to = CodeMirror.Pos(cur.line, cur.ch);

  return {list, from, to};
}

/**
 * Replace the text in the editor when a hint is selected.
 * This also makes sure there is whitespace surrounding it
 * @param cm
 * @param self
 * @param data
 */
function replaceHintMatch (cm, self, data) {
  const prevChar = cm.getRange(CodeMirror.Pos(self.from.line, self.from.ch - 1), self.from);
  const nextChar = cm.getRange(self.to, CodeMirror.Pos(self.to.line, self.to.ch + 1));

  let prefix = prevChar === ' ' ? '' : ' ';
  let suffix = nextChar === ' ' ? '' : ' ';

  cm.replaceRange(`${prefix}${data.text}${suffix}`, self.from, self.to);
}

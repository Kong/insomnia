import CodeMirror from 'codemirror';
import 'codemirror/addon/mode/overlay';

const NAME_MATCH = /[\w.\][\-/]+$/;
const AFTER_VARIABLE_MATCH = /{{\s*[\w.\][]*$/;
const AFTER_TAG_MATCH = /{%\s*[\w.\][]*$/;
const COMPLETE_AFTER_VARIABLE_NAME = /[\w.\][]+/;
const COMPLETE_AFTER_CURLIES = /[^{]*\{[{%]\s*/;
const COMPLETION_CLOSE_KEYS = /[}|]/;
const MAX_HINT_LOOK_BACK = 100;
const HINT_DELAY_MILLIS = 100;
const TYPE_VARIABLE = 'variable';
const TYPE_TAG = 'tag';
const TYPE_CONSTANT = 'constant';
const MAX_VARIABLES = 15;
const MAX_TAGS = 10;
const MAX_CONSTANTS = 5;

const ICONS = {
  [TYPE_VARIABLE]: '&nu;',
  [TYPE_TAG]: '&fnof;',
  [TYPE_CONSTANT]: '&#x1d436;'
};

const TAGS = {
  uuid: '',
  now: '',
  response: ''
};

CodeMirror.defineExtension('isHintDropdownActive', function () {
  return (
    this.state.completionActive &&
    this.state.completionActive.data &&
    this.state.completionActive.data.list &&
    this.state.completionActive.data.list.length
  );
});

CodeMirror.defineOption('environmentAutocomplete', null, (cm, options) => {
  if (!options) {
    return;
  }

  function completeAfter (cm, fn, showAllOnNoMatch = false) {
    // Bail early if didn't match the callback test
    if (fn && !fn()) {
      return CodeMirror.Pass;
    }

    // Bail early if completions are showing already
    if (cm.isHintDropdownActive()) {
      return CodeMirror.Pass;
    }

    // Put the hints in a container with class "dropdown__menu" (for themes)
    let hintsContainer = document.querySelector('#hints-container');
    if (!hintsContainer) {
      const el = document.createElement('div');
      el.id = 'hints-container';
      el.className = 'dropdown__menu';
      document.body.appendChild(el);
      hintsContainer = el;
    }

    const constants = options.getConstants && options.getConstants();

    // Actually show the hint
    cm.showHint({
      // Insomnia-specific options
      extraConstants: constants || [],

      // Codemirror native options
      hint,
      getContext: options.getContext,
      showAllOnNoMatch,
      container: hintsContainer,
      closeCharacters: COMPLETION_CLOSE_KEYS,
      completeSingle: false,
      // closeOnUnfocus: false, // Good for debugging (inspector)
      extraKeys: {
        'Tab': (cm, widget) => {
          // Override default behavior and don't select hint on Tab
          widget.close();
          return CodeMirror.Pass;
        }
      }
    });

    return CodeMirror.Pass;
  }

  function completeIfInVariableName (cm) {
    return completeAfter(cm, () => {
      const cur = cm.getCursor();
      const pos = CodeMirror.Pos(cur.line, cur.ch - MAX_HINT_LOOK_BACK);
      const range = cm.getRange(pos, cur);
      return range.match(COMPLETE_AFTER_VARIABLE_NAME);
    });
  }

  function completeIfAfterTagOrVarOpen (cm) {
    return completeAfter(cm, () => {
      const cur = cm.getCursor();
      const pos = CodeMirror.Pos(cur.line, cur.ch - MAX_HINT_LOOK_BACK);
      const range = cm.getRange(pos, cur);
      return range.match(COMPLETE_AFTER_CURLIES);
    }, true);
  }

  function completeForce (cm) {
    return completeAfter(cm, null, true);
  }

  cm.on('keydown', (cm, e) => {
    // Only operate on one-letter keys. This will filter out
    // any special keys (Backspace, Enter, etc)
    if (e.key.length > 1) {
      return;
    }

    // In a timeout so it gives the editor chance to update first
    setTimeout(() => completeIfInVariableName(cm), HINT_DELAY_MILLIS);
  });

  // Add hot key triggers
  cm.addKeyMap({
    'Ctrl-Space': completeForce, // Force autocomplete on hotkey
    "' '": completeIfAfterTagOrVarOpen
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

  // See if we're allowed matching tags, vars, or both
  const isInVariable = previousText.match(AFTER_VARIABLE_MATCH);
  const isInTag = previousText.match(AFTER_TAG_MATCH);
  const isInNothing = !isInVariable && !isInTag;
  const allowMatchingVariables = isInNothing || isInVariable;
  const allowMatchingTags = isInNothing || isInTag;
  const allowMatchingConstants = isInNothing;

  // Define fallback segment to match everything or nothing
  const fallbackSegment = options.showAllOnNoMatch ? '' : '__will_not_match_anything__';

  // See if we're completing a variable name
  const nameMatch = previousText.match(NAME_MATCH);
  const nameSegment = nameMatch ? nameMatch[0] : fallbackSegment;

  // Actually try to match the list of things
  const context = await options.getContext();
  const allMatches = [];

  if (allowMatchingConstants) {
    const constantMatches = matchStrings(
      options.extraConstants,
      nameSegment,
      TYPE_CONSTANT,
      MAX_CONSTANTS
    );
    allMatches.push(constantMatches);
  }

  if (allowMatchingVariables) {
    const variableMatches = matchStrings(
      context.keys,
      nameSegment,
      TYPE_VARIABLE,
      MAX_VARIABLES
    );
    allMatches.push(variableMatches);
  }

  if (allowMatchingTags) {
    const tagMatches = matchStrings(
      TAGS,
      nameSegment,
      TYPE_TAG,
      MAX_TAGS
    );
    allMatches.push(tagMatches);
  }

  const list = [].concat(...allMatches);
  const from = CodeMirror.Pos(cur.line, cur.ch - nameSegment.length);
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
  const prevChars = cm.getRange(CodeMirror.Pos(self.from.line, self.from.ch - 10), self.from);
  const nextChars = cm.getRange(self.to, CodeMirror.Pos(self.to.line, self.to.ch + 10));

  let prefix = '';
  let suffix = '';

  if (data.type === TYPE_VARIABLE && !prevChars.match(/{{\s*$/)) {
    prefix = '{{ '; // If no closer before
  } else if (data.type === TYPE_VARIABLE && prevChars.match(/{{$/)) {
    prefix = ' '; // If no space after opener
  } else if (data.type === TYPE_TAG && !prevChars.match(/{%\s*$/)) {
    prefix = '{% '; // If no closer before
  } else if (data.type === TYPE_TAG && prevChars.match(/{%$/)) {
    prefix = ' '; // If no space after opener
  }

  if (data.type === TYPE_VARIABLE && !nextChars.match(/^\s*}}/)) {
    suffix = ' }}'; // If no closer after
  } else if (data.type === TYPE_VARIABLE && nextChars.match(/^}}/)) {
    suffix = ' '; // If no space before closer
  } else if (data.type === TYPE_TAG && !nextChars.match(/^\s*%}/)) {
    suffix = ' %}'; // If no closer after
  } else if (data.type === TYPE_TAG && nextChars.match(/^%}/)) {
    suffix = ' '; // If no space before closer
  } else if (data.type === TYPE_TAG && nextChars.match(/^\s*}/)) {
    // Edge case because "%" doesn't auto-close tags so sometimes you end
    // up in the scenario of {% foo}
    suffix = ' %';
  }

  cm.replaceRange(`${prefix}${data.text}${suffix}`, self.from, self.to);
}

function matchStrings (stringsArrayOrObj, segment, type, limit = 20) {
  // If it's an array, convert it to an object with no values
  if (Array.isArray(stringsArrayOrObj)) {
    const map = {};
    for (const c of stringsArrayOrObj) {
      map[c] = '';
    }
    stringsArrayOrObj = map;
  }

  return Object.keys(stringsArrayOrObj)
    .filter(k => k.toLowerCase().includes(segment.toLowerCase()))
    .slice(0, limit)
    .map(k => {
      const value = stringsArrayOrObj[k];
      return {
        // Custom Insomnia keys
        type,
        segment,
        comment: stringsArrayOrObj[k],
        displayValue: value ? JSON.stringify(value) : '',
        score: k.length,

        // CodeMirror
        text: k,
        displayText: k,
        render: renderHintMatch,
        hint: replaceHintMatch
      };
    })
    .sort((a, b) => a.score > b.score ? 1 : -1);
}

/**
 * Replace all occurrences of string
 * @param text
 * @param find
 * @param prefix
 * @param suffix
 * @returns string
 */
function replaceWithSurround (text, find, prefix, suffix) {
  const escapedString = find.replace(/[-[\]/{}()*+?.\\^$|]/g, '\\$&');
  const re = new RegExp(escapedString, 'gi');
  return text.replace(re, matched => prefix + matched + suffix);
}

/**
 * Render the autocomplete list entry
 * @param li
 * @param self
 * @param data
 */
function renderHintMatch (li, self, data) {
  // Bold the matched text
  const {displayText, segment} = data;
  const markedName = replaceWithSurround(displayText, segment, '<strong>', '</strong>');

  li.innerHTML = `
    <label class="label">${ICONS[data.type]}</label>
    <div class="name">${markedName}</div>
    <div class="value" title=${data.displayValue}>
      ${data.displayValue}
    </div>
  `;

  li.className += ` type--${data.type}`;
}

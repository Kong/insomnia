import CodeMirror from 'codemirror';
import 'codemirror/addon/mode/overlay';
import { getDefaultFill } from '../../../../templating/utils';
import { escapeHTML, escapeRegex } from '../../../../common/misc';

const NAME_MATCH_FLEXIBLE = /[\w.\][\-/]+$/;
const NAME_MATCH = /[\w.\][]+$/;
const AFTER_VARIABLE_MATCH = /{{\s*[\w.\][]*$/;
const AFTER_TAG_MATCH = /{%\s*[\w.\][]*$/;
const COMPLETE_AFTER_WORD = /[\w.\][-]+/;
const COMPLETE_AFTER_CURLIES = /[^{]*{[{%]\s*/;
const COMPLETION_CLOSE_KEYS = /[}|-]/;
const MAX_HINT_LOOK_BACK = 100;
const HINT_DELAY_MILLIS = 700;
const TYPE_VARIABLE = 'variable';
const TYPE_TAG = 'tag';
const TYPE_CONSTANT = 'constant';
const MAX_CONSTANTS = -1;
const MAX_VARIABLES = -1;
const MAX_TAGS = -1;

const ICONS = {
  [TYPE_CONSTANT]: { char: '&#x1d484;', title: 'Constant' },
  [TYPE_VARIABLE]: { char: '&#x1d465;', title: 'Environment Variable' },
  [TYPE_TAG]: { char: '&fnof;', title: 'Generator Tag' }
};

CodeMirror.defineExtension('isHintDropdownActive', function() {
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

  async function completeAfter(cm, fn, showAllOnNoMatch = false) {
    // Bail early if didn't match the callback test
    if (fn && !fn()) {
      return;
    }

    if (!cm.hasFocus()) {
      return;
    }

    // Bail early if completions are showing already
    if (cm.isHintDropdownActive()) {
      return;
    }

    let hintsContainer = document.querySelector('#hints-container');
    if (!hintsContainer) {
      const el = document.createElement('div');
      el.id = 'hints-container';
      el.className = 'theme--dropdown__menu';
      document.body.appendChild(el);
      hintsContainer = el;
    }

    const constants = options.getConstants ? await options.getConstants() : null;
    const variables = options.getVariables ? await options.getVariables() : null;
    const tags = options.getTags ? await options.getTags() : null;

    // Actually show the hint
    cm.showHint({
      // Insomnia-specific options
      constants: constants || [],
      variables: variables || [],
      tags: tags || [],
      showAllOnNoMatch,

      // Codemirror native options
      hint,
      container: hintsContainer,
      closeCharacters: COMPLETION_CLOSE_KEYS,
      completeSingle: false,
      extraKeys: {
        Tab: (cm, widget) => {
          // Override default behavior and don't select hint on Tab
          widget.close();
          return CodeMirror.Pass;
        }
      }

      // Good for debugging
      // ,closeOnUnfocus: false
    });
  }

  function completeIfInVariableName(cm) {
    completeAfter(cm, () => {
      const cur = cm.getCursor();
      const pos = CodeMirror.Pos(cur.line, cur.ch - MAX_HINT_LOOK_BACK);
      const range = cm.getRange(pos, cur);
      return range.match(COMPLETE_AFTER_WORD);
    });

    return CodeMirror.Pass;
  }

  function completeIfAfterTagOrVarOpen(cm) {
    completeAfter(
      cm,
      () => {
        const cur = cm.getCursor();
        const pos = CodeMirror.Pos(cur.line, cur.ch - MAX_HINT_LOOK_BACK);
        const range = cm.getRange(pos, cur);
        return range.match(COMPLETE_AFTER_CURLIES);
      },
      true
    );

    return CodeMirror.Pass;
  }

  function completeForce(cm) {
    completeAfter(cm, null, true);
    return CodeMirror.Pass;
  }

  let keydownDebounce = null;

  cm.on('keydown', (cm, e) => {
    // Close autocomplete on Escape if it's open
    if (cm.isHintDropdownActive() && e.key === 'Escape') {
      if (!cm.state.completionActive) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      cm.state.completionActive.close();
    }

    // Only operate on one-letter keys. This will filter out
    // any special keys (Backspace, Enter, etc)
    if (e.metaKey || e.ctrlKey || e.altKey || e.key.length > 1) {
      return;
    }

    clearTimeout(keydownDebounce);
    keydownDebounce = setTimeout(() => {
      completeIfInVariableName(cm);
    }, HINT_DELAY_MILLIS);
  });

  // Clear timeout if we already closed the completion
  cm.on('endCompletion', () => {
    clearTimeout(keydownDebounce);
  });

  // Remove keymap if we're already added it
  cm.removeKeyMap('autocomplete-keymap');

  // Add keymap
  cm.addKeyMap({
    name: 'autocomplete-keymap',
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
function hint(cm, options) {
  const variablesToMatch = options.variables || [];
  const constantsToMatch = options.constants || [];
  const tagsToMatch = options.tags || [];

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
  const nameMatchLong = previousText.match(NAME_MATCH_FLEXIBLE);
  const nameSegment = nameMatch ? nameMatch[0] : fallbackSegment;
  const nameSegmentLong = nameMatchLong ? nameMatchLong[0] : fallbackSegment;
  const nameSegmentFull = previousText;

  // Actually try to match the list of things
  const lowPriorityMatches = [];
  const highPriorityMatches = [];

  let mode;
  try {
    mode = cm.getOption('mode').baseMode;
  } catch (e) {
    mode = 'unknown';
  }

  // Match variables
  if (allowMatchingVariables) {
    matchSegments(variablesToMatch, nameSegment, TYPE_VARIABLE, MAX_VARIABLES).forEach(m =>
      lowPriorityMatches.push(m)
    );
    matchSegments(variablesToMatch, nameSegmentLong, TYPE_VARIABLE, MAX_VARIABLES).forEach(m =>
      highPriorityMatches.push(m)
    );
  }

  // Match constants
  if (allowMatchingConstants) {
    const cur = cm.getCursor();
    const token = cm.getTokenAt(cur);

    if (mode === 'graphql-variables') {
      const segment = token.string
        .trim()
        .replace(/^{?"?/, '') // Remove leading '{' and spaces
        .replace(/"?}?$/, ''); // Remove trailing quotes and spaces

      if (token.type === 'variable') {
        // We're inside a JSON key
        matchSegments(constantsToMatch, segment, TYPE_CONSTANT, MAX_CONSTANTS).forEach(m =>
          highPriorityMatches.push(m)
        );
      } else if (
        token.type === 'invalidchar' ||
        token.type === 'ws' ||
        (token.type === 'punctuation' && token.string === '{')
      ) {
        // We're outside of a JSON key
        matchSegments(constantsToMatch, segment, TYPE_CONSTANT, MAX_CONSTANTS).forEach(m =>
          highPriorityMatches.push({ ...m, text: '"' + m.text + '": ' })
        );
      }
    } else {
      // Otherwise match full segments
      matchSegments(constantsToMatch, nameSegmentFull, TYPE_CONSTANT, MAX_CONSTANTS).forEach(m =>
        highPriorityMatches.push(m)
      );
    }
  }

  // Match tags
  if (allowMatchingTags) {
    matchSegments(tagsToMatch, nameSegment, TYPE_TAG, MAX_TAGS).forEach(m =>
      lowPriorityMatches.push(m)
    );
    matchSegments(tagsToMatch, nameSegmentLong, TYPE_TAG, MAX_TAGS).forEach(m =>
      highPriorityMatches.push(m)
    );
  }

  const matches = [...highPriorityMatches, ...lowPriorityMatches];

  // Autocomplete from longest matched segment
  const segment = highPriorityMatches.length ? nameSegmentLong : nameSegment;

  const uniqueMatches = matches.reduce(
    (arr, v) => (arr.find(a => a.text === v.text) ? arr : [...arr, v]),
    [] // Default value
  );

  return {
    list: uniqueMatches,
    from: CodeMirror.Pos(cur.line, cur.ch - segment.length),
    to: CodeMirror.Pos(cur.line, cur.ch)
  };
}

/**
 * Replace the text in the editor when a hint is selected.
 * This also makes sure there is whitespace surrounding it
 * @param cm
 * @param self
 * @param data
 */
function replaceHintMatch(cm, self, data) {
  const cur = cm.getCursor();
  const from = CodeMirror.Pos(cur.line, cur.ch - data.segment.length);
  const to = CodeMirror.Pos(cur.line, cur.ch);

  const prevStart = CodeMirror.Pos(from.line, from.ch - 10);
  const prevChars = cm.getRange(prevStart, from);

  const nextEnd = CodeMirror.Pos(to.line, to.ch + 10);
  const nextChars = cm.getRange(to, nextEnd);

  let prefix = '';
  let suffix = '';

  if (data.type === TYPE_VARIABLE && !prevChars.match(/{{[^}]*$/)) {
    prefix = '{{ '; // If no closer before
  } else if (data.type === TYPE_VARIABLE && prevChars.match(/{{$/)) {
    prefix = ' '; // If no space after opener
  } else if (data.type === TYPE_TAG && prevChars.match(/{%$/)) {
    prefix = ' '; // If no space after opener
  } else if (data.type === TYPE_TAG && !prevChars.match(/{%[^%]*$/)) {
    prefix = '{% '; // If no closer before
  }

  if (data.type === TYPE_VARIABLE && !nextChars.match(/^\s*}}/)) {
    suffix = ' }}'; // If no closer after
  } else if (data.type === TYPE_VARIABLE && nextChars.match(/^}}/)) {
    suffix = ' '; // If no space before closer
  } else if (data.type === TYPE_TAG && nextChars.match(/^%}/)) {
    suffix = ' '; // If no space before closer
  } else if (data.type === TYPE_TAG && nextChars.match(/^\s*}/)) {
    // Edge case because "%" doesn't auto-close tags so sometimes you end
    // up in the scenario of {% foo}
    suffix = ' %';
  } else if (data.type === TYPE_TAG && !nextChars.match(/^\s*%}/)) {
    suffix = ' %}'; // If no closer after
  }

  cm.replaceRange(`${prefix}${data.text}${suffix}`, from, to);
}

/**
 * Match against a list of things
 * @param listOfThings - Can be list of strings or list of {name, value}
 * @param segment - segment to match against
 * @param type
 * @param limit
 * @returns {Array}
 */
function matchSegments(listOfThings, segment, type, limit = -1) {
  if (!Array.isArray(listOfThings)) {
    console.warn('Autocomplete received items in non-list form', listOfThings);
    return [];
  }

  const matches = [];
  for (const t of listOfThings) {
    const name = typeof t === 'string' ? t : t.name;
    const value = typeof t === 'string' ? '' : t.value;
    const displayName = t.displayName || name;
    const defaultFill = typeof t === 'string' ? name : getDefaultFill(t.name, t.args);

    const matchSegment = segment.toLowerCase();
    const matchName = displayName.toLowerCase();

    // Throw away things that don't match
    if (!matchName.includes(matchSegment)) {
      continue;
    }

    matches.push({
      // Custom Insomnia keys
      type,
      segment,
      comment: value,
      displayValue: value ? JSON.stringify(value) : '',
      score: name.length, // In case we want to sort by this

      // CodeMirror
      text: defaultFill,
      displayText: displayName,
      render: renderHintMatch,
      hint: replaceHintMatch
    });
  }

  if (limit >= 0) {
    return matches.slice(0, limit);
  } else {
    return matches;
  }
}

/**
 * Replace all occurrences of string
 * @param text
 * @param find
 * @param prefix
 * @param suffix
 * @returns string
 */
function replaceWithSurround(text, find, prefix, suffix) {
  const escapedString = escapeRegex(find);
  const re = new RegExp(escapedString, 'gi');
  return text.replace(re, matched => prefix + matched + suffix);
}

/**
 * Render the autocomplete list entry
 * @param li
 * @param self
 * @param data
 */
function renderHintMatch(li, self, data) {
  // Bold the matched text
  const { displayText, segment } = data;
  const markedName = replaceWithSurround(displayText, segment, '<strong>', '</strong>');

  const { char, title } = ICONS[data.type];

  let html = `
    <label class="label" title="${title}">${char}</label>
    <div class="name">${markedName}</div>
    <div class="value" title=${data.displayValue}>
      ${escapeHTML(data.displayValue || '')}
    </div>
  `;

  li.innerHTML = html;
  li.className += ` fancy-hint type--${data.type}`;
}

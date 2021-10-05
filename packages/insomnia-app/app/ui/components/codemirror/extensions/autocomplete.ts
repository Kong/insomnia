import 'codemirror/addon/mode/overlay';

import CodeMirror, { EnvironmentAutocompleteOptions, Hint, ShowHintOptions } from 'codemirror';

import { getPlatformKeyCombinations, hotKeyRefs } from '../../../../common/hotkeys';
import { escapeHTML, escapeRegex, isNotNullOrUndefined } from '../../../../common/misc';
import { getDefaultFill, NunjucksParsedTag } from '../../../../templating/utils';
import { isNunjucksMode } from '../modes/nunjucks';

const NAME_MATCH_FLEXIBLE = /[\w.\][\-/]+$/;
const NAME_MATCH = /[\w.\][]+$/;
const AFTER_VARIABLE_MATCH = /{{\s*[\w.\][]*$/;
const AFTER_TAG_MATCH = /{%\s*[\w.\][]*$/;
const COMPLETE_AFTER_WORD = /[\w.\][-]+/;
const COMPLETE_AFTER_CURLIES = /[^{]*{[{%]\s*/;
const COMPLETION_CLOSE_KEYS = /[}|-]/;
const MAX_HINT_LOOK_BACK = 100;
const TYPE_VARIABLE = 'variable';
const TYPE_TAG = 'tag';
const TYPE_CONSTANT = 'constant';
const TYPE_SNIPPET = 'snippet';
const MAX_CONSTANTS = -1;
const MAX_SNIPPETS = -1;
const MAX_VARIABLES = -1;
const MAX_TAGS = -1;
const ICONS = {
  [TYPE_CONSTANT]: {
    char: '𝒄',
    title: 'Constant',
  },
  [TYPE_SNIPPET]: {
    char: '§',
    title: 'Snippet',
  },
  [TYPE_VARIABLE]: {
    char: '𝑥',
    title: 'Environment Variable',
  },
  [TYPE_TAG]: {
    char: 'ƒ',
    title: 'Generator Tag',
  },
};

CodeMirror.defineExtension('isHintDropdownActive', function() {
  return (
    this.state.completionActive &&
    this.state.completionActive.data &&
    this.state.completionActive.data.list &&
    this.state.completionActive.data.list.length
  );
});

CodeMirror.defineExtension('closeHintDropdown', function() {
  this.state.completionActive?.close();
});

CodeMirror.defineOption('environmentAutocomplete', null, (cm: CodeMirror.EditorFromTextArea, options: EnvironmentAutocompleteOptions) => {
  if (!options) {
    return;
  }

  async function completeAfter(cm: CodeMirror.EditorFromTextArea, callback?: () => boolean, showAllOnNoMatch = false) {
    // Bail early if didn't match the callback test
    if (callback && !callback()) {
      return;
    }

    if (!cm.hasFocus()) {
      return;
    }

    // Bail early if completions are showing already
    if (cm.isHintDropdownActive()) {
      return;
    }

    let hintsContainer = document.querySelector<HTMLElement>('#hints-container');

    if (!hintsContainer) {
      const el = document.createElement('div');
      el.id = 'hints-container';
      el.className = 'theme--dropdown__menu';
      document.body.appendChild(el);
      hintsContainer = el;
    }

    const constants = options.getConstants ? await options.getConstants() : null;
    const variables = options.getVariables ? await options.getVariables() : null;
    const snippets = options.getSnippets ? await options.getSnippets() : null;
    const tags = options.getTags ? await options.getTags() : null;
    // Actually show the hint
    cm.showHint({
      // Insomnia-specific options
      constants: constants || [],
      variables: variables || [],
      snippets: snippets || [],
      tags: tags || [],
      showAllOnNoMatch,
      // Codemirror native options
      hint,
      container: hintsContainer,
      closeCharacters: COMPLETION_CLOSE_KEYS,
      completeSingle: false,
      extraKeys: {
        Tab: (_cm, widget) => {
          // Override default behavior and don't select hint on Tab
          widget.close();
          return CodeMirror.Pass;
        },
      },
      // Good for debugging
      // closeOnUnfocus: false,
    });
  }

  function completeIfInVariableName(cm: CodeMirror.EditorFromTextArea) {
    completeAfter(cm, () => {
      const cur = cm.getCursor();
      const pos = CodeMirror.Pos(cur.line, cur.ch - MAX_HINT_LOOK_BACK);
      const range = cm.getRange(pos, cur);

      return COMPLETE_AFTER_WORD.test(range);
    });
    return CodeMirror.Pass;
  }

  function completeIfAfterTagOrVarOpen(cm: CodeMirror.EditorFromTextArea) {
    completeAfter(
      cm,
      () => {
        const cur = cm.getCursor();
        const pos = CodeMirror.Pos(cur.line, cur.ch - MAX_HINT_LOOK_BACK);
        const range = cm.getRange(pos, cur);

        return COMPLETE_AFTER_CURLIES.test(range);
      },
      true,
    );
    return CodeMirror.Pass;
  }

  function completeForce(cm: CodeMirror.EditorFromTextArea) {
    completeAfter(cm, undefined, true);
    return CodeMirror.Pass;
  }

  function setupKeyMap(
    cm: CodeMirror.EditorFromTextArea,
    {
      completeIfAfterTagOrVarOpen,
      completeForce,
    } : {
      completeIfAfterTagOrVarOpen: (
        cm: CodeMirror.EditorFromTextArea
      ) => void | typeof CodeMirror.Pass;
      completeForce: (
        cm: CodeMirror.EditorFromTextArea
      ) => void | typeof CodeMirror.Pass;
    }
  ) {
    // Remove keymap if we're already added it
    cm.removeKeyMap('autocomplete-keymap');

    const keyBindings = options.hotKeyRegistry[hotKeyRefs.SHOW_AUTOCOMPLETE.id];
    const keyCombs = getPlatformKeyCombinations(keyBindings);

    const keymap: CodeMirror.KeyMap = {
      name: 'autocomplete-keymap',
      "' '": completeIfAfterTagOrVarOpen,
    };

    // Construct valid codemirror key names from KeyCombination items. The order (Shift-Cmd-Ctrl-Alt) of the modifier is important https://codemirror.net/doc/manual.html#keymaps
    for (const keyComb of keyCombs) {
      const alt = keyComb.alt ? 'Alt-' : '';
      const ctrl = keyComb.ctrl ? 'Ctrl-' : '';
      // Cmd- is used to register the meta key of all platforms by CodeMirror
      const meta = keyComb.meta ? 'Cmd-' : '';
      const shift = keyComb.shift ? 'Shift-' : '';
      const keyname = CodeMirror.keyNames[keyComb.keyCode];

      const key = `${shift}${meta}${ctrl}${alt}${keyname}`;
      keymap[key] = completeForce;
    }

    cm.addKeyMap(keymap);
  }

  let keydownTimeoutHandle: NodeJS.Timeout | null = null;
  cm.on('keydown', (cm: CodeMirror.EditorFromTextArea, e) => {
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

    if (keydownTimeoutHandle !== null) {
      clearTimeout(keydownTimeoutHandle);
    }

    if (options.autocompleteDelay > 0) {
      keydownTimeoutHandle = setTimeout(() => {
        completeIfInVariableName(cm);
      }, options.autocompleteDelay);
    }
  });

  // Clear timeout if we already closed the completion
  cm.on('endCompletion', () => {
    if (keydownTimeoutHandle !== null) {
      clearTimeout(keydownTimeoutHandle);
    }
  });

  setupKeyMap(cm, { completeForce, completeIfAfterTagOrVarOpen });
});

/**
 * Function to retrieve the list items
 * @param cm
 * @param options
 * @returns {Promise.<{list: Array, from, to}>}
 */
function hint(cm: CodeMirror.EditorFromTextArea, options: ShowHintOptions) {
  // Add type to all things (except constants, which need to convert to an object)
  const variablesToMatch: VariableCompletionItem[] = (options.variables || []).map(v => ({ ...v, type: TYPE_VARIABLE }));
  const snippetsToMatch: SnippetCompletionItem[] = (options.snippets || []).map(v => ({ ...v, type: TYPE_SNIPPET }));
  const tagsToMatch: TagCompletionItem[] = (options.tags || []).map(v => ({ ...v, type: TYPE_TAG }));
  const constantsToMatch: ConstantCompletionItem[] = (options.constants || []).map(s => ({
    name: s,
    value: s,
    displayValue: '',
    // No display since name === value
    type: TYPE_CONSTANT,
  }));
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
  let lowPriorityMatches: Hint[] = [];
  let highPriorityMatches: Hint[] = [];

  const modeOption = cm.getOption('mode') ?? 'unknown';

  let mode = 'unknown';

  if (typeof modeOption === 'string') {
    mode = modeOption;
  } else if (isNunjucksMode(modeOption)) {
    mode = modeOption.baseMode;
  }

  // Match variables
  if (allowMatchingVariables) {
    const sortVariableCompletionHints = getCompletionHints(variablesToMatch, nameSegment, TYPE_VARIABLE, MAX_VARIABLES);
    lowPriorityMatches = [...lowPriorityMatches, ...sortVariableCompletionHints];

    const longVariableCompletionHints = getCompletionHints(variablesToMatch, nameSegmentLong, TYPE_VARIABLE, MAX_VARIABLES);

    highPriorityMatches = [...highPriorityMatches, ...longVariableCompletionHints];
  }

  // Match constants
  if (allowMatchingConstants) {
    const cur = cm.getCursor();
    const token = cm.getTokenAt(cur);

    if (mode === 'graphql-variables') {
      const segment = token.string
        .trim()
        .replace(/^{?"?/, '') // Remove leading '{' and spaces
        .replace(/"?}?$/, '');

      // Remove trailing quotes and spaces
      if (token.type === 'variable') {
        // We're inside a JSON key
        const constantCompletionHints = getCompletionHints(constantsToMatch, segment, TYPE_CONSTANT, MAX_CONSTANTS);
        highPriorityMatches = [...highPriorityMatches, ...constantCompletionHints];

      } else if (
        token.type === 'invalidchar' ||
        token.type === 'ws' ||
        (token.type === 'punctuation' && token.string === '{')
      ) {
        // We're outside of a JSON key
        const constantCompletionHints = getCompletionHints(constantsToMatch, segment, TYPE_CONSTANT, MAX_CONSTANTS).map(hint => ({ ...hint, text: '"' + hint.text + '": ' }));

        highPriorityMatches = [...highPriorityMatches, ...constantCompletionHints];
      }
    } else {
      // Otherwise match full segments
      const hints = getCompletionHints(constantsToMatch, nameSegmentFull, TYPE_CONSTANT, MAX_CONSTANTS);

      highPriorityMatches = [...highPriorityMatches, ...hints];
    }
  }

  // Match tags
  if (allowMatchingTags) {
    const lowPriorityTagHints = getCompletionHints(tagsToMatch, nameSegment, TYPE_TAG, MAX_TAGS);

    lowPriorityMatches = [...lowPriorityMatches, ...lowPriorityTagHints];

    const highPriorityTagHints = getCompletionHints(tagsToMatch, nameSegmentLong, TYPE_TAG, MAX_TAGS);

    highPriorityMatches = [...highPriorityMatches, ...highPriorityTagHints];
  }

  const snippetHints = getCompletionHints(snippetsToMatch, nameSegment, TYPE_SNIPPET, MAX_SNIPPETS);

  highPriorityMatches = [...highPriorityMatches, ...snippetHints];

  const matches = [...highPriorityMatches, ...lowPriorityMatches];
  // Autocomplete from longest matched segment
  const segment = highPriorityMatches.length ? nameSegmentLong : nameSegment;
  const uniqueMatches = matches.reduce(
    (arr, v) => (arr.find(a => a.text === v.text) ? arr : [...arr, v]),
    [] as Hint[], // Default value
  );
  return {
    list: uniqueMatches,
    from: CodeMirror.Pos(cur.line, cur.ch - segment.length),
    to: CodeMirror.Pos(cur.line, cur.ch),
  };
}

/**
 * Replace the text in the EditorFromTextArea when a hint is selected.
 * This also makes sure there is whitespace surrounding it
 * @param cm
 * @param self
 * @param data
 */
async function replaceHintMatch(cm: CodeMirror.EditorFromTextArea, _self, data) {
  if (typeof data.text === 'function') {
    data.text = await data.text();
  }

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

// @TODO Simplify these types and make the interface stricter and move the transforms in the top level.
interface CompletionItemKind {
  name: string;
  displayName?: string;
  displayValue?: string;
  value?: string | (() => PromiseLike<unknown>);
  type: typeof TYPE_CONSTANT | typeof TYPE_SNIPPET | typeof TYPE_VARIABLE | typeof TYPE_TAG;
}

interface ConstantCompletionItem extends CompletionItemKind {
  type: typeof TYPE_CONSTANT;
  value: string;
}

interface VariableCompletionItem extends CompletionItemKind {
  type: typeof TYPE_VARIABLE;
  value: string | (() => PromiseLike<unknown>);
}

interface SnippetCompletionItem extends CompletionItemKind {
  type: typeof TYPE_SNIPPET;
  value: string | (() => PromiseLike<unknown>);
}

interface TagCompletionItem extends NunjucksParsedTag, CompletionItemKind {
  type: typeof TYPE_TAG;
}

type CompletionItem = ConstantCompletionItem | VariableCompletionItem | SnippetCompletionItem | TagCompletionItem;

function isConstantCompletionItem(item: CompletionItem): item is ConstantCompletionItem {
  return item.type === TYPE_CONSTANT;
}

function isVariableCompletionItem(item: CompletionItem): item is VariableCompletionItem {
  return item.type === TYPE_VARIABLE;
}

function isSnippetCompletionItem(item: CompletionItem): item is SnippetCompletionItem {
  return item.type === TYPE_SNIPPET;
}

function isTagCompletionItem(item: CompletionItem): item is TagCompletionItem {
  return item.type === TYPE_TAG;
}

function getCompletionHints(completionItems: CompletionItem[], segment: string, type: CompletionItem['type'], limit = -1): Hint[] {
  const matches: CodeMirror.Hint[] = [];

  for (const item of completionItems) {
    const name = typeof item === 'string' ? item : item.name;
    const value = typeof item === 'string' ? '' : item.value ?? '';
    const displayName = item.displayName || name;
    let defaultFill = '';

    if (isConstantCompletionItem(item)) {
      defaultFill = item.value;
    } else if (isVariableCompletionItem(item) || isSnippetCompletionItem(item)) {
      defaultFill = item.name;
    } else if (isTagCompletionItem(item)) {
      defaultFill = getDefaultFill(item.name, item.args);
    }

    const matchSegment = segment.toLowerCase();
    const matchName = displayName.toLowerCase() || '';

    // Throw away things that don't match
    if (!matchName.includes(matchSegment)) {
      continue;
    }

    let displayValue = item.displayValue || '';

    if (typeof item.displayValue !== 'string' && typeof value !== 'function') {
      displayValue = JSON.stringify(value);
    }

    matches.push({
      type,
      segment,
      displayValue: displayValue,
      comment: value.toString(),
      score: name.length,
      text: defaultFill,
      displayText: displayName || name,
      render: renderHintMatch,
      hint: replaceHintMatch,
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
 */
function replaceWithSurround(text: string, find: string, prefix: string, suffix: string) {
  const escapedString = escapeRegex(find);
  const re = new RegExp(escapedString, 'gi');
  return text.replace(re, matched => prefix + matched + suffix);
}

/**
 * Render the autocomplete list entry
 */
function renderHintMatch(li: HTMLElement, _allHints: CodeMirror.Hints, hint: Hint) {
  // Bold the matched text
  const { displayText, segment, type, displayValue } = hint;
  const markedName = replaceWithSurround(displayText || '', segment, '<strong>', '</strong>');
  const { char, title } = ICONS[type];
  let safeValue = '';

  if (isNotNullOrUndefined<string>(displayValue)) {
    const escaped = escapeHTML(displayValue);
    safeValue = `
      <div class="value" title=${escaped}>
        ${escaped}
      </div>
    `;
  }

  li.className += ` fancy-hint type--${type}`;
  li.innerHTML = `
    <label class="label" title="${title}">${char}</label>
    <div class="name">${markedName}</div>
    ${safeValue}
  `;
}

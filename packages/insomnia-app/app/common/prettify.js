const STATE_IN_NUN_VAR = 'nunvar';
const STATE_IN_NUN_TAG = 'nuntag';
const STATE_IN_NUN_COM = 'nuncom';
const STATE_IN_STRING = 'string';
const STATE_NONE = 'none';

const NUNJUCKS_OPEN_STATES = {
  '{{': STATE_IN_NUN_VAR,
  '{%': STATE_IN_NUN_TAG,
  '{#': STATE_IN_NUN_COM
};

const NUNJUCKS_CLOSE_STATES = {
  '}}': STATE_IN_NUN_VAR,
  '%}': STATE_IN_NUN_TAG,
  '#}': STATE_IN_NUN_COM
};

/**
 * Format a JSON string without parsing it as JavaScript.
 *
 * Code taken from jsonlint (http://zaa.ch/jsonlint/)
 *
 * @param json
 * @param indentChars
 * @returns {string}
 */
export function prettifyJson (json, indentChars = '\t') {
  if (!json) {
    return '';
  }

  // Convert the unicode. To correctly mimic JSON.stringify(JSON.parse(json), null, indentChars)
  // we need to convert all escaped unicode characters to proper unicode characters.
  try {
    json = _convertUnicode(json);
  } catch (err) {
    // Just in case (should never happen)
    console.warn('Prettify failed to handle unicode', err);
  }

  let i = 0;
  let il = json.length;
  let tab = indentChars;
  let newJson = '';
  let indentLevel = 0;
  let currentChar = null;
  let nextChar = null;
  let nextTwo = null;
  let state = STATE_NONE;

  for (; i < il; i += 1) {
    currentChar = json.charAt(i);
    nextChar = json.charAt(i + 1) || '';
    nextTwo = currentChar + nextChar;

    if (state === STATE_IN_STRING) {
      if (currentChar === '"') {
        state = STATE_NONE;
        newJson += currentChar;
        continue;
      } else if (currentChar === '\\') {
        newJson += currentChar + nextChar;
        i++;
        continue;
      } else {
        newJson += currentChar;
        continue;
      }
    }

    // Close Nunjucks states
    if (Object.values(NUNJUCKS_CLOSE_STATES).includes(state)) {
      const closeState = NUNJUCKS_CLOSE_STATES[nextTwo];
      if (closeState) {
        state = STATE_NONE;
        if (closeState === STATE_IN_NUN_COM) {
          // Put comments on their own lines
          newJson += nextTwo + '\n' + _repeatString(tab, indentLevel);
        } else {
          newJson += nextTwo;
        }
        i++;
        continue;
      } else {
        newJson += currentChar;
        continue;
      }
    }

    // ~~~~~~~~~~~~~~~~~~~~~~ //
    // Handle "nothing" State //
    // ~~~~~~~~~~~~~~~~~~~~~~ //

    // Open Nunjucks states
    const nextState = NUNJUCKS_OPEN_STATES[nextTwo];
    if (nextState) {
      state = nextState;
      newJson += nextTwo;
      i++;
      continue;
    }

    switch (currentChar) {
      case ',':
        newJson += currentChar + '\n' + _repeatString(tab, indentLevel);
        continue;
      case '{':
        if (nextChar === '}') {
          newJson += currentChar + nextChar;
          i++;
        } else {
          indentLevel++;
          newJson += currentChar + '\n' + _repeatString(tab, indentLevel);
        }
        continue;
      case '[':
        if (nextChar === ']') {
          newJson += currentChar + nextChar;
          i++;
        } else {
          indentLevel++;
          newJson += currentChar + '\n' + _repeatString(tab, indentLevel);
        }
        continue;
      case '}':
        indentLevel--;
        newJson += '\n' + _repeatString(tab, indentLevel) + currentChar;
        continue;
      case ']':
        indentLevel--;
        newJson += '\n' + _repeatString(tab, indentLevel) + currentChar;
        continue;
      case ':':
        newJson += ': ';
        continue;
      case '"':
        state = STATE_IN_STRING;
        newJson += currentChar;
        continue;
      case ' ':
      case '\n':
      case '\t':
      case '\r':
        // Don't add whitespace
        continue;
      default:
        newJson += currentChar;
        continue;
    }
  }

  // Remove lines that only contain whitespace
  return newJson.replace(/^\s*\n/gm, '');
}

function _repeatString (s, count) {
  return new Array(count + 1).join(s);
}

/**
 * Convert escaped unicode characters to real characters. Any JSON parser will do this by
 * default. This is really fast too. Around 25ms for ~2MB of data with LOTS of unicode.
 *
 * @param originalStr
 * @returns {string}
 * @private
 */
function _convertUnicode (originalStr) {
  let m;
  let c;
  let lastI = 0;

  // Matches \u####
  const unicodeRegex = /\\u([0-9a-fA-F]{4})/g;

  let convertedStr = '';
  while ((m = unicodeRegex.exec(originalStr))) {
    try {
      c = String.fromCharCode(parseInt(m[1], 16));
      if (c === '"') {
        // Escape it if it's double quotes
        c = `\\${c}`;
      }
      convertedStr += originalStr.slice(lastI, m.index) + c;
      lastI = m.index + m[0].length;
    } catch (err) {
      // Some reason we couldn't convert a char. Should never actually happen
      console.warn('Failed to convert unicode char', m[1], err);
    }
  }

  // Finally, add the rest of the string to the end.
  convertedStr += originalStr.slice(lastI, originalStr.length);

  return convertedStr;
}

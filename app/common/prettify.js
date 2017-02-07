/**
 * Format a JSON string without parsing it as JavaScript.
 *
 * Code taken from jsonlint (http://zaa.ch/jsonlint/)
 *
 * @param json
 * @param indentChars
 * @returns {string}
 */
export function prettifyJson (json, indentChars) {
  let i = 0;
  let il = json.length;
  let tab = (typeof indentChars !== 'undefined') ? indentChars : '    ';
  let newJson = '';
  let indentLevel = 0;
  let inString = false;
  let currentChar = null;
  let previousChar = null;
  let nextChar = null;

  for (;i < il; i += 1) {
    currentChar = json.charAt(i);
    previousChar = json.charAt(i - 1);
    nextChar = json.charAt(i + 1);

    switch (currentChar) {
      case '{':
        if (!inString && nextChar !== '}') {
          newJson += currentChar + '\n' + _repeatString(tab, indentLevel + 1);
          indentLevel += 1;
        } else {
          newJson += currentChar;
        }
        break;
      case '[':
        if (!inString && nextChar !== ']') {
          newJson += currentChar + '\n' + _repeatString(tab, indentLevel + 1);
          indentLevel += 1;
        } else {
          newJson += currentChar;
        }
        break;
      case '}':
        if (!inString && previousChar !== '{') {
          indentLevel -= 1;
          newJson += '\n' + _repeatString(tab, indentLevel) + currentChar;
        } else {
          newJson += currentChar;
        }
        break;
      case ']':
        if (!inString && previousChar !== '[') {
          indentLevel -= 1;
          newJson += '\n' + _repeatString(tab, indentLevel) + currentChar;
        } else {
          newJson += currentChar;
        }
        break;
      case ',':
        if (!inString) {
          newJson += ',\n' + _repeatString(tab, indentLevel);
        } else {
          newJson += currentChar;
        }
        break;
      case ':':
        if (!inString) {
          newJson += ': ';
        } else {
          newJson += currentChar;
        }
        break;
      case ' ':
      case '\n':
      case '\t':
        if (inString) {
          newJson += currentChar;
        }
        break;
      case '"':
        if (i > 0 && previousChar !== '\\') {
          inString = !inString;
        }
        newJson += currentChar;
        break;
      default:
        newJson += currentChar;
        break;
    }
  }

  return newJson;
}

function _repeatString(s, count) {
  return new Array(count + 1).join(s);
}

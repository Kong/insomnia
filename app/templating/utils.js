/**
 * Get list of paths to all primitive types in nested object
 * @param {object} obj - object to analyse
 * @param {String} [prefix] - base path to prefix to all paths
 * @returns {Array} - list of paths
 */
export function getKeys (obj, prefix = '') {
  let allKeys = [];

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      allKeys = [...allKeys, ...getKeys(obj[i], `${prefix}[${i}]`)];
    }
  } else if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      const newPrefix = prefix ? `${prefix}.${key}` : key;
      allKeys = [...allKeys, ...getKeys(obj[key], newPrefix)];
    }
  } else if (typeof obj === 'function') {
    // Skip functions
  } else if (prefix) {
    allKeys.push({name: prefix, value: obj});
  }

  return allKeys;
}

/**
 *
 * @param tagStr
 */
export function tokenizeTag (tagStr) {
  // ~~~~~~~~ //
  // Sanitize //
  // ~~~~~~~~ //

  const withoutEnds = tagStr
    .trim()
    .replace(/^{%/, '')
    .replace(/%}$/, '')
    .trim();

  const nameMatch = withoutEnds.match(/^[a-zA-Z_$][0-9a-zA-Z_$]*/);
  const name = nameMatch ? nameMatch[0] : withoutEnds;
  const argsStr = withoutEnds.slice(name.length);

  // ~~~~~~~~~~~~~ //
  // Tokenize Args //
  // ~~~~~~~~~~~~~ //

  const args = [];
  let quotedBy = null;
  let currentArg = null;
  for (let i = 0; i < argsStr.length; i++) {
    const c = argsStr.charAt(i);

    // Do nothing if we're still on a space o comma
    if (currentArg === null && c.match(/[\s,]/)) {
      continue;
    }

    // Start a new single-quoted string
    if (currentArg === null && c === "'") {
      currentArg = '';
      quotedBy = "'";
      continue;
    }

    // Start a new double-quoted string
    if (currentArg === null && c === '"') {
      currentArg = '';
      quotedBy = '"';
      continue;
    }

    // Start a new unquoted string
    if (currentArg === null) {
      currentArg = c;
      quotedBy = null;
      continue;
    }

    const endQuoted = quotedBy && c === quotedBy;
    const endUnquoted = !quotedBy && c === ',';
    const finalChar = i === argsStr.length - 1;
    const argCompleted = endQuoted || endUnquoted;

    // Append current char to argument
    if (!argCompleted && currentArg !== null) {
      if (c === '\\') {
        // Handle backslashes
        i += 1;
        currentArg += argsStr.charAt(i);
      } else {
        currentArg += c;
      }
    }

    // End current argument
    if (currentArg !== null && (argCompleted || finalChar)) {
      let type;
      if (quotedBy) {
        type = 'literal'; // string
      } else if (['true', 'false', 'null'].includes(currentArg)) {
        type = 'literal'; // keyword
      } else if (currentArg.match(/^\d*\.?\d*$/)) {
        type = 'literal'; // number
      } else if (currentArg.match(/^[a-zA-Z_$][0-9a-zA-Z_$]*$/)) {
        type = 'variable';
      } else {
        type = 'expression';
      }

      args.push({type, value: currentArg});

      currentArg = null;
      quotedBy = null;
    }
  }

  return {name, args};
}

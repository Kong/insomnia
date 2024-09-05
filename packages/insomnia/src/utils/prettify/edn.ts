const delimitersData = [
  // Procedence matters
  ['#{', '}'],
  ['{', '}'],
  ['[', ']'],
];

const [startDelimiters, endDelimiters] = delimitersData.reduce(
  (acc, e) => {
    acc[0].push(e[0]);
    acc[1].push(e[1]);
    return acc;
  },
  [[], []] as typeof delimitersData
);

function tokenize(edn: string) {
  let insideString = false;

  const tokens: string[] = [];

  let symbol = '';

  for (const c of edn) {
    if (!insideString) {
      // Ignore when
      if (c === ',' || c === '\n' || c === '\r' || c === '\t' || (c === ' ')) {
        if (symbol) {
          tokens.push(symbol);
          symbol = '';
        }
        continue;
      } else if (c === '"') {
        insideString = true;
        symbol += c;
      } else if (startDelimiters.includes(symbol + c)) {
        tokens.push(symbol + c);
        symbol = '';
      } else if (endDelimiters.includes(c)) {
        if (symbol) {
          tokens.push(symbol);
        }
        tokens.push(c);
        symbol = '';
      } else {
        symbol += c;
      }
      continue;
    }

    if (c === '"' && symbol.at(-1) !== '\\') {
      insideString = false;
      tokens.push(symbol + c);
      symbol = '';
    } else {
      symbol += c;
    }
  }

  return tokens;
}

function spacesOnLeft(spaces: number[]) {
  const length = spaces.reduce((acc, e) => acc + e, 0);

  return Array.from({ length })
    .map(() => ' ')
    .join('');
}

function tokensToLines(tokens: ReturnType<typeof tokenize>) {
  const lines: string[][] = [];

  const elements: { spaces: number; perLine: number }[] = [];

  let currentLine: string[] = [];

  let keyValue: string[] = [];

  let tokenUsed = false;

  for (const [i, t] of tokens.entries()) {
    const nextToken = tokens.at(i + 1);
    const nextEnding = nextToken && endDelimiters.includes(nextToken);

    if (tokenUsed) {
      const line = currentLine.join('');
      // Check if its a empty structure, in that case, store current line and start a new one
      if (!nextEnding && line.trim()) {
        lines.push(currentLine);
        currentLine = [spacesOnLeft(elements.map(e => e.spaces))];
      }
      tokenUsed = false;
      continue;
    }

    const startDelimiter = startDelimiters.includes(t);
    const endDelimiter = endDelimiters.includes(t);

    if (startDelimiter) {
      keyValue = [];
      currentLine.push(t);
      if (nextEnding) {
        currentLine.push(nextToken);
        tokenUsed = true;
      } else {
        const currenLineLength = currentLine.map(e => e.length).reduce((acc, e) => acc + e);
        const spacesAlreadyCounted = elements.reduce((acc, e) => acc + e.spaces, 0);
        elements.push({ spaces: currenLineLength - spacesAlreadyCounted, perLine: t === '{' ? 2 : 1 });
      }
      continue;
    }

    if (endDelimiter) {
      keyValue = [];
      if (currentLine.length > 1) {
        currentLine.push(t);
        lines.push(currentLine);
      } else {
        lines.at(-1)!.push(t);
      }
      elements.pop();
      currentLine = [spacesOnLeft(elements.map(e => e.spaces))];
      continue;
    }

    currentLine.push(t);

    // Token can be a key, value or metadata, only key and value are valid for line count
    // Metadata are tokens started with # like #uuid
    if (!t.startsWith('#')) {
      keyValue.push(t);
    }

    let endLine = false;

    // If the line already contains a key and value, go to next line
    if (keyValue.length === elements.at(-1)?.perLine) {
      keyValue = [];
      endLine = true;
    }

    // If line is not ending and next token is not a closing delimiter, continue for next token
    if (!endLine && !nextEnding) {
      currentLine.push(' ');
      continue;
    }

    // If the next token is a close delimiter, use this delimiter instead of key/value for end of line
    if (nextEnding) {
      currentLine.push(nextToken);
      tokenUsed = true;
      elements.pop();
    }

    lines.push(currentLine);
    currentLine = [spacesOnLeft(elements.map(e => e.spaces))];
  }

  lines.push(currentLine);

  return lines.map(l => l.join('')).filter(e => e);
}

export const ednPrettify = (edn: string) => {
  const tokens = tokenize(edn);

  if (!startDelimiters.includes(tokens[0])) {
    return edn;
  }

  const lines = tokensToLines(tokens);

  return lines.join('\n');
};

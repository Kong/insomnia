const delimitersData = [
  // Procedence matters
  ["#{", "}"],
  ["{", "}"],
  ["[", "]"]
]

const [startDelimiters, endDelimiters] = delimitersData.reduce(
  (acc, e) => {
    acc[0].push(e[0]);
    acc[1].push(e[1]);
    return acc;
  },
  [[], []] as typeof delimitersData
);

function spacesOnLeft(spaces: number[]) {
  const length = spaces.reduce((acc, e) => acc + e, 0);

  return Array.from({ length })
    .map(() => " ")
    .join("");
}

export const ednPrettify = (edn: string, _filter?: string) => {
  let insideString = false;

  let tokens: string[] = [];

  let symbol = "";

  // let newSymbol = false

  for (const c of edn) {
    if (!insideString) {
      // Ignore when
      if (c === "," || c === "\n" || (c === " " && !symbol)) {
        symbol = "";
        continue;
      } else if (c === '"') {
        insideString = true;
        symbol += c;
      } else if (c === " " && symbol) {
        tokens.push(symbol);
        symbol = "";
      } else if (startDelimiters.includes(symbol + c)) {
        tokens.push(symbol + c);
        symbol = "";
      } else if (endDelimiters.includes(c)) {
        if (symbol) {
          tokens.push(symbol);
        }
        tokens.push(c);
        symbol = "";
      } else {
        symbol += c;
      }
    } else {
      if (c === '"' && symbol !== "\\") {
        insideString = false;
        tokens.push(symbol + c);
        symbol = "";
      } else {
        symbol += c;
      }
    }
  }

  let lines: string[] = [];

  let currentLine: string[] = [];

  let currentLineStartStructure = false;

  let keyValue: string[] = [];

  let spaces: number[] = [];

  let tokenUsed = false;

  for (const [i, t] of tokens.entries()) {
    // If this token already been used, continue for next token
    if (tokenUsed) {
      tokenUsed = false;
      continue;
    }

    // Adds this token to current line
    currentLine.push(t);

    // If its a delimiter, will continue for next token
    const startDelimiter = startDelimiters.includes(t);
    const endDelimiter = endDelimiters.includes(t);

    if (startDelimiter || endDelimiter) {
      if (startDelimiter) {
        keyValue = [];
        currentLineStartStructure = true;
        console.log({ currentLine, spaces });
        spaces.push(
          currentLine.map((e) => e.length).reduce((acc, e) => acc + e) -
            spaces.reduce((acc, e) => acc + e, 0)
        );
      }
      continue;
    }

    // Token can be a key, value or metadata, only key and value are valid for line count
    // Metadata are tokens started with # like #uuid
    if (!t.startsWith("#")) {
      keyValue.push(t);
    }

    let endLine = false;

    // If the line already contains a key and value, go to next line
    if (keyValue.length === 2) {
      keyValue = [];
      endLine = true;
    }

    const nextToken = tokens.at(i + 1);
    const nextEnding = nextToken && endDelimiters.includes(nextToken);

    // If line is not ending and next token is not a closing delimiter, continue for next token
    if (!endLine && !nextEnding) {
      currentLine.push(" ");
      continue;
    }

    // If the next token is a close delimiter, use this delimiter instead of key/value for end of line
    if (nextEnding) {
      currentLine.push(nextToken);
      tokenUsed = true;
      console.log("element removed, ", spaces.pop());
    }

    // Create line, add to lines and prepare for next line
    const line = currentLine.join("");
    // console.log({ spaces, currentLineStartStructure, line });
    lines.push(line);
    currentLineStartStructure = false;
    console.log({ spaces, line });
    currentLine = [spacesOnLeft(spaces)];
  }

  return lines.join("\n") + currentLine.join("").trim();
};

// console.log(ednPrettify(`{:name #uuid "garug"
// :age 20
// :enabled true
// :likes #{{:name "Paris"}
// {:name "Londres"}}}`));

// console.log(
//   ednPrettify(
//     `{:name #uuid "garug" :age 20 :enabled true :likes #{"dogs" "cats"}}`
//   )
// );

// console.log(ednPrettify(`{:prop1 {:prop2 {:prop3 :b}}}`));

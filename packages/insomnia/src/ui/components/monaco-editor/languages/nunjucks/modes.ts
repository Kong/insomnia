import * as monaco from 'monaco-editor';

export function getMatchTokens(model: monaco.editor.ITextModel) {
  const value = model.getValue();
  const regexVariable = /{{\s*([^ }]+)\s*[^}]*\s*}}/g;
  const regexTag = /{%\s*([^ }]+)\s*[^%]*\s*%}/g;
  // const regexComment = /{#\s*[^#]+\s*#}/;

  const matches: { range: monaco.Range; token: string; type: 'variable' | 'tag' | 'comment' }[] = [];
  let matchVariable;
  let matchTag;
  while ((matchVariable = regexVariable.exec(value)) !== null) {
    const startPos = model.getPositionAt(matchVariable.index); // Start position of the match
    const endPos = model.getPositionAt(matchVariable.index + matchVariable[0].length); // End position of the match
    const tokenRange = new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column);
    matches.push({
      range: tokenRange,
      token: matchVariable[1],
      type: 'variable',
    });
  };
  while ((matchTag = regexTag.exec(value)) !== null) {
    const startPos = model.getPositionAt(matchTag.index); // Start position of the match
    const endPos = model.getPositionAt(matchTag.index + matchTag[0].length); // End position of the match
    const tokenRange = new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column);
    matches.push({
      range: tokenRange,
      token: matchTag[1],
      type: 'tag',
    });
  };
  return matches;
}

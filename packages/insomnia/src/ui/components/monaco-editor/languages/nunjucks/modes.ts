import * as monaco from 'monaco-editor';

import { getTagDefinitions } from '../../../../../templating';
import { tokenizeTag } from '../../../../../templating/utils';

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
      token: matchVariable[0],
      type: 'variable',
    });
  };
  while ((matchTag = regexTag.exec(value)) !== null) {
    const startPos = model.getPositionAt(matchTag.index); // Start position of the match
    const endPos = model.getPositionAt(matchTag.index + matchTag[0].length); // End position of the match
    const tokenRange = new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column);
    matches.push({
      range: tokenRange,
      token: matchTag[0],
      type: 'tag',
    });
  };
  return matches;
}

export async function updateTokenText(text: string, render: any, renderContext: any) {
  let innerHTML = '';
  let title = '';
  let dataIgnore = '';
  let dataError = '';
  let contextForKey = '';
  const str = text.replace(/\\/g, '');
  const tagMatch = str.match(/{% *([^ ]+) *.*%}/);
  const cleanedStr = str
    .replace(/^{%/, '')
    .replace(/%}$/, '')
    .replace(/^{{/, '')
    .replace(/}}$/, '')
    .trim();

  try {
    if (tagMatch) {
      const tagData = tokenizeTag(str);
      const tagDefinition = (await getTagDefinitions()).find(d => d.name === tagData.name);

      if (tagDefinition) {
        // Try rendering these so we can show errors if needed
        // @ts-expect-error -- TSCONVERSION
        const liveDisplayName = tagDefinition.liveDisplayName(tagData.args);
        const firstArg = tagDefinition.args[0];

        if (liveDisplayName) {
          innerHTML = liveDisplayName;
        } else if (firstArg && firstArg.type === 'enum') {
          const argData = tagData.args[0];
          // @ts-expect-error -- TSCONVERSION
          const foundOption = firstArg.options.find(d => d.value === argData.value);
          // @ts-expect-error -- TSCONVERSION
          const option = foundOption || firstArg.options[0];
          innerHTML = `${tagDefinition.displayName} &rArr; ${option.displayName}`;
        } else {
          innerHTML = tagDefinition.displayName || tagData.name;
        }

        const preview = await render(text);
        // @ts-expect-error -- TSCONVERSION
        title = tagDefinition.disablePreview(tagData.args) ? preview.replace(/./g, '*') : preview;
      } else {
        innerHTML = cleanedStr;
        title = 'Unrecognized tag';
        dataIgnore = 'on';
      }
    } else {
      // Render if it's a variable
      title = await render(str);
      const context = await renderContext();
      const con = context.context.getKeysContext();
      contextForKey = con.keyContext[cleanedStr];
      innerHTML = cleanedStr;
    }

    dataError = 'off';
  } catch (err) {
    title = err.message.replace(/\[.+,.+]\s*/, '');
    dataError = 'on';
  }

  return {
    key: contextForKey,
    value: title,
    dataError: dataError === 'on',
    dataIgnore: dataIgnore === 'on',
    content: innerHTML,
    cleanedStr,
  };
};

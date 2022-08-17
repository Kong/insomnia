import React, { FC } from 'react';

import { clickLink } from '../../../common/electron-helpers';
import type { ResponseTimelineEntry } from '../../../main/network/libcurl-promise';
import { CodeEditor } from '../codemirror/code-editor';

interface Props {
  responseId: string;
  timeline: ResponseTimelineEntry[];
}

export const ResponseTimelineViewer: FC<Props> = ({ responseId, timeline }) => {
  const rows = timeline
    .map(({ name, value }, i, all) => {
      const prefixLookup: Record<ResponseTimelineEntry['name'], string> = {
        HeaderIn: '< ',
        DataIn: '| ',
        SslDataIn: '<< ',
        HeaderOut: '> ',
        DataOut: '| ',
        SslDataOut: '>> ',
        Text: '* ',
      };
      const prefix: string = prefixLookup[name] || '* ';
      const lines = (value + '').replace(/\n$/, '').split('\n');
      const newLines = lines.filter(l => !l.match(/^\s*$/)).map(l => `${prefix}${l}`);
      // Prefix each section with a newline to separate them
      const previousName = i > 0 ? all[i - 1].name : '';

      const hasNameChanged = previousName !== name;
      // Join all lines together
      return (hasNameChanged ? '\n' : '') + newLines.join('\n');
    })
    .filter(r => r !== null)
    .join('\n')
    .trim();
  return (
    <CodeEditor
      key={responseId}
      hideLineNumbers
      readOnly
      onClickLink={clickLink}
      defaultValue={rows}
      className="pad-left"
      mode="curl"
    />
  );
};

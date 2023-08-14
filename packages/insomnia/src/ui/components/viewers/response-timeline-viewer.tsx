import React, { FC, useEffect, useRef } from 'react';

import type { ResponseTimelineEntry } from '../../../main/network/libcurl-promise';
import { CodeEditor, CodeEditorHandle } from '../codemirror/code-editor';

interface Props {
  timeline: ResponseTimelineEntry[];
  pinToBottom?: boolean;
}

export const ResponseTimelineViewer: FC<Props> = ({ timeline, pinToBottom }) => {
  const editorRef = useRef<CodeEditorHandle>(null);
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

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current?.setValue(rows);
    }
  }, [rows]);

  return (
    <CodeEditor
      id="response-timeline-viewer"
      ref={editorRef}
      hideLineNumbers
      readOnly
      onClickLink={window.main.openInBrowser}
      defaultValue={rows}
      className="pad-left"
      mode="curl"
      pinToBottom={pinToBottom}
    />
  );
};

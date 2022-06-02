import React, { forwardRef } from 'react';

import { CodeEditor, UnconnectedCodeEditor } from '../codemirror/code-editor';

interface Props {
  value: string;
  responseId?: string;
}

export const ResponseRawViewer = forwardRef<UnconnectedCodeEditor, Props>(({ responseId, value }, ref) => (
  <CodeEditor
    ref={ref}
    defaultValue={value}
    hideLineNumbers
    mode="text/plain"
    noMatchBrackets
    placeholder="..."
    raw
    readOnly
    uniquenessKey={responseId}
  />
));

ResponseRawViewer.displayName = 'ResponseRawViewer';

import React, { forwardRef } from 'react';

import { CodeEditor, CodeEditorHandle } from '../codemirror/code-editor';

interface Props {
  value: string;
  responseId?: string;
}

export const ResponseRawViewer = forwardRef<CodeEditorHandle, Props>(({ responseId, value }, ref) => (
  <CodeEditor
    ref={ref}
    className="raw-editor"
    defaultValue={value}
    hideLineNumbers
    mode="text/plain"
    noMatchBrackets
    placeholder="..."
    readOnly
    uniquenessKey={responseId}
  />
));

ResponseRawViewer.displayName = 'ResponseRawViewer';

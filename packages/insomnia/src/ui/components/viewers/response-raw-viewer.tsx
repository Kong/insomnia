import React, { forwardRef } from 'react';

import { CodeEditor } from '../codemirror/code-editor';

interface Props {
  value: string;
  responseId?: string;
}
const ResponseRawViewerWithRef = (props: Props, ref) => {
  const { responseId, value } = props;
  return (
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
  );
};
export const ResponseRawViewer = forwardRef(ResponseRawViewerWithRef);

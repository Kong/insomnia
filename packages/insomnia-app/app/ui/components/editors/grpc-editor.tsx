import React, { FunctionComponent } from 'react';

import { CodeEditor } from '../codemirror/code-editor';

interface Props {
  content?: string;
  handleChange?: (arg0: string) => void;
  readOnly?: boolean;
}

export const GRPCEditor: FunctionComponent<Props> = ({
  content,
  handleChange,
  readOnly,
}) => (
  <CodeEditor
    defaultValue={content}
    onChange={handleChange}
    mode="application/json"
    enableNunjucks
    readOnly={readOnly}
    autoPrettify={readOnly}
    manualPrettify={!readOnly}
  />
);

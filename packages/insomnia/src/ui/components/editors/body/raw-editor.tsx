import React, { FC, Fragment } from 'react';

import { CodeEditor,  CodeEditorOnChange } from '../../codemirror/code-editor';

interface Props {
  onChange: CodeEditorOnChange;
  content: string;
  contentType: string;
  uniquenessKey: string;
  className?: string;
}

export const RawEditor: FC<Props> = ({
  className,
  content,
  contentType,
  onChange,
  uniquenessKey,
}) => (
  <Fragment>
    <CodeEditor
      manualPrettify
      uniquenessKey={uniquenessKey}
      defaultValue={content}
      className={className}
      enableNunjucks
      onChange={onChange}
      mode={contentType}
      placeholder="..."
    />
  </Fragment>
);

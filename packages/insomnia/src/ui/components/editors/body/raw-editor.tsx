import React, { FC, Fragment } from 'react';

import { CodeEditor } from '../../codemirror/code-editor';

interface Props {
  onChange: (value: string) => void;
  content: string;
  contentType: string;
  uniquenessKey: string;
  className?: string;
  // pd-dazzle-update
  isVisualizeEditor?: boolean;
}

export const RawEditor: FC<Props> = ({
  className,
  content,
  contentType,
  onChange,
  uniquenessKey,
  isVisualizeEditor,
}) => (
  <Fragment>
    <CodeEditor
      id="raw-editor"
      showPrettifyButton
      uniquenessKey={uniquenessKey}
      defaultValue={content}
      className={className}
      enableNunjucks
      onChange={onChange}
      mode={contentType}
      placeholder="..."
      isVisualizeEditor={isVisualizeEditor}
    />
  </Fragment>
);

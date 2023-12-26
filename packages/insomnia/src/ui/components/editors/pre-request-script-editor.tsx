import React, { FC, Fragment } from 'react';

import { CodeEditor } from '../codemirror/code-editor';

interface Props {
    onChange: (value: string) => void;
    content: string;
    contentType: string;
    uniquenessKey: string;
    className?: string;
}

export const PreRequestScriptEditor: FC<Props> = ({
    className,
    content,
    contentType,
    onChange,
    uniquenessKey,
}) => (
    <Fragment>
        <CodeEditor
          id="pre-request-script-editor"
          showPrettifyButton
          uniquenessKey={uniquenessKey}
          defaultValue={content}
          className={className}
        //   enableNunjucks
          onChange={onChange}
          mode={contentType}
          placeholder="..."
        />
    </Fragment>
);

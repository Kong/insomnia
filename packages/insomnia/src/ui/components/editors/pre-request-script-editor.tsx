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
}) => {

  const lintOptions = {
    globals: {
      // https://jshint.com/docs/options/
      insomnia: true,
      pm: true,
      require: true,
      console: true,
    },
    asi: true,
    // Don't require semicolons
    undef: true,
    // Prevent undefined usages
    node: true,
    esversion: 8, // ES8 syntax (async/await, etc)
  };

  const editor = <Fragment>
    <CodeEditor
      key={uniquenessKey}
      id="pre-request-script-editor"
      showPrettifyButton
      uniquenessKey={uniquenessKey}
      defaultValue={content}
      className={className}
      //   enableNunjucks
      onChange={onChange}
      mode={contentType}
      placeholder="..."
      lintOptions={lintOptions}
    />
  </Fragment>;

  return editor;
};

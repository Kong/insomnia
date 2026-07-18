import React, { type FC, Fragment } from 'react';

import { CodeEditor } from '~/ui/components/.client/codemirror/code-editor';

import { AnalyticsEvent } from '../../../../ui/analytics';

interface Props {
  onChange: (value: string) => void;
  content: string;
  contentType: string;
  historyKey: string;
  className?: string;
}

export const RawEditor: FC<Props> = ({ className, content, contentType, onChange, historyKey }) => (
  <Fragment>
    <CodeEditor
      id="raw-editor"
      showPrettifyButton
      historyKey={historyKey}
      defaultValue={content}
      className={className}
      enableNunjucks
      onChange={onChange}
      mode={contentType}
      placeholder="..."
      onPrettify={() => {
        window.main.trackAnalyticsEvent({ event: AnalyticsEvent.requestBodyBeautifyClicked });
      }}
    />
  </Fragment>
);

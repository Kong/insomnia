import React, { type FC, Fragment } from 'react';

import { CodeEditor } from '~/ui/components/.client/codemirror/code-editor';

import { SegmentEvent } from '../../../../ui/analytics';

interface Props {
  onChange: (value: string) => void;
  content: string;
  contentType: string;
  uniquenessKey: string;
  className?: string;
}

export const RawEditor: FC<Props> = ({ className, content, contentType, onChange, uniquenessKey }) => (
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
      onPrettify={() => {
        window.main.trackSegmentEvent({ event: SegmentEvent.requestBodyBeautifyClicked });
      }}
    />
  </Fragment>
);

import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { Fragment, PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../../common/constants';
import { CodeEditor,  CodeEditorOnChange } from '../../codemirror/code-editor';

interface Props {
  onChange: CodeEditorOnChange;
  content: string;
  contentType: string;
  uniquenessKey: string;
  className?: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class RawEditor extends PureComponent<Props> {
  render() {
    const {
      className,
      content,
      contentType,
      onChange,
      uniquenessKey,
    } = this.props;
    return (
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
  }
}

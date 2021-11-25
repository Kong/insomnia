import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { Fragment, PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../../common/constants';
import { HandleGetRenderContext, HandleRender } from '../../../../common/render';
import { CodeEditor,  CodeEditorOnChange } from '../../codemirror/code-editor';

interface Props {
  onChange: CodeEditorOnChange;
  content: string;
  contentType: string;
  uniquenessKey: string;
  isVariableUncovered: boolean;
  className?: string;
  render?: HandleRender;
  getRenderContext?: HandleGetRenderContext;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class RawEditor extends PureComponent<Props> {
  render() {
    const {
      className,
      content,
      contentType,
      getRenderContext,
      isVariableUncovered,
      onChange,
      render,
      uniquenessKey,
    } = this.props;
    return (
      <Fragment>
        <CodeEditor
          manualPrettify
          uniquenessKey={uniquenessKey}
          defaultValue={content}
          className={className}
          render={render}
          getRenderContext={getRenderContext}
          isVariableUncovered={isVariableUncovered}
          onChange={onChange}
          mode={contentType}
          placeholder="..."
        />
      </Fragment>
    );
  }
}

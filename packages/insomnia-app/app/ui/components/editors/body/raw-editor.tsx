import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { Fragment, PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../../common/constants';
import { CodeEditor,  CodeEditorOnChange } from '../../codemirror/code-editor';

interface Props {
  onChange: CodeEditorOnChange;
  content: string;
  contentType: string;
  fontSize: number;
  indentSize: number;
  keyMap: string;
  lineWrapping: boolean;
  nunjucksPowerUserMode: boolean;
  uniquenessKey: string;
  isVariableUncovered: boolean;
  className?: string;
  indentWithTabs?: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class RawEditor extends PureComponent<Props> {
  render() {
    const {
      className,
      content,
      contentType,
      fontSize,
      indentSize,
      keyMap,
      lineWrapping,
      indentWithTabs,
      nunjucksPowerUserMode,
      isVariableUncovered,
      onChange,
      uniquenessKey,
    } = this.props;
    return (
      <Fragment>
        <CodeEditor
          manualPrettify
          uniquenessKey={uniquenessKey}
          fontSize={fontSize}
          indentSize={indentSize}
          indentWithTabs={indentWithTabs}
          keyMap={keyMap}
          defaultValue={content}
          className={className}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          isVariableUncovered={isVariableUncovered}
          onChange={onChange}
          mode={contentType}
          lineWrapping={lineWrapping}
          placeholder="..."
        />
      </Fragment>
    );
  }
}

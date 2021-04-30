import React, { Fragment, PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../../common/constants';
import CodeEditor from '../../codemirror/code-editor';

interface Props {
  onChange: Function;
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
  render?: Function;
  getRenderContext?: Function;
  indentWithTabs?: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class RawEditor extends PureComponent<Props> {
  render() {
    const {
      className,
      content,
      contentType,
      fontSize,
      getRenderContext,
      indentSize,
      keyMap,
      lineWrapping,
      indentWithTabs,
      nunjucksPowerUserMode,
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
          fontSize={fontSize}
          indentSize={indentSize}
          indentWithTabs={indentWithTabs}
          keyMap={keyMap}
          defaultValue={content}
          className={className}
          render={render}
          getRenderContext={getRenderContext}
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

export default RawEditor;

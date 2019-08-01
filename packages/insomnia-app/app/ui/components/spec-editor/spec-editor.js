// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import CodeEditor from '../codemirror/code-editor';
import SAMPLE_SPEC from './petstore-sample';

type Props = {|
  editorFontSize: number,
  editorIndentSize: number,
  lineWrapping: boolean,
  editorKeyMap: string,
|};

@autobind
class SpecEditor extends React.PureComponent<Props> {
  render() {
    const {
      editorFontSize,
      editorIndentSize,
      lineWrapping,
      editorKeyMap,
    } = this.props;

    return (
      <div className="spec-editor theme--pane">
        <div className="spec-editor__header theme--pane__header">
          <h1>OpenAPI Spec</h1>
        </div>
        <div className="spec-editor__body theme--pane__body">
          <CodeEditor
            fontSize={editorFontSize}
            indentSize={editorIndentSize}
            lineWrapping={lineWrapping}
            keyMap={editorKeyMap}
            mode="yaml"
            defaultValue={SAMPLE_SPEC}
          />
        </div>
      </div>
    );
  }
}

export default SpecEditor;

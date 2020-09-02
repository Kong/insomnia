// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import CodeEditor from '../codemirror/code-editor';
import type { Settings } from '../../../models/settings';

type Props = {
  onChange: Function,
  contentType: String,
  settings: Settings,
  handleRender: Function,
  handleGetRenderContext: Function,
};

@autobind
class ExamplesEditor extends React.PureComponent<Props> {
  constructor(props) {
    super(props);

    this.state = {
      editorContent: null,
    };
  }

  _handleRawChange(rawValue: string) {
    // const { onChange, request } = this.props;
    // onChange(request, newBody);
    this.props.onChange(rawValue);
    // this.setState({ editorContent: rawValue });
  }

  _setEditorRef(n) {
    this._editor = n;
  }

  focusEnd() {
    this._editor && this._editor.focusEnd();
  }

  focus() {
    this._editor && this._editor.focus();
  }

  render() {
    const {
      request,
      settings,
      contentType,
      content,
      handleRender: render,
      handleGetRenderContext: getRenderContext,
    } = this.props;

    const noRender = request.settingDisableRenderRequestBody;
    const handleRender = noRender ? null : render;
    const handleGetRenderContext = noRender ? null : getRenderContext;

    const uniqueKey = `${request._id}::${noRender ? 'no-render' : 'render'}`;

    return (
      // <CodeEditor
      //     ref={this._setEditorRef}
      //     uniquenessKey={uniqueKey}
      //     fontSize={settings.editorFontSize}
      //     indentSize={settings.editorIndentSize}
      //     keyMap={settings.editorKeyMap}
      //     lineWrapping={settings.editorLineWrapping}
      //     indentWithTabs={settings.editorIndentWithTabs}
      //     contentType={'application/json'}
      //     dynamicHeight={true}
      //     placeholder="Write a description"
      //     render={handleRender}
      //     getRenderContext={handleGetRenderContext}
      //     isVariableUncovered={true}
      //     nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
      //     onChange={this._handleRawChange}
      // />
      <CodeEditor
        ref={this._setEditorRef}
        uniquenessKey={uniqueKey}
        hideGutters
        hideLineNumbers
        dynamicHeight={true}
        manualPrettify
        noStyleActiveLine
        mode={contentType || 'application/json'}
        placeholder="Write a description"
        debounceMillis={300}
        keyMap={settings.editorKeyMap}
        fontSize={settings.editorFontSize}
        lineWrapping={settings.editorLineWrapping}
        indentSize={settings.editorIndentSize}
        defaultValue={content}
        render={handleRender}
        getRenderContext={handleGetRenderContext}
        nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
        isVariableUncovered={true}
        onChange={this._handleRawChange}
      />
    );
  }
}

export default ExamplesEditor;

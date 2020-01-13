// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import CodeEditor from '../codemirror/code-editor';
import type { Workspace } from '../../../models/workspace';
import type { ApiSpec } from '../../../models/api-spec';
import HelpLink from '../help-link';
import YAML from 'yaml';
import { showError, showModal } from '../modals';
import CodePromptModal from '../modals/code-prompt-modal';
import SwaggerUI from 'swagger-ui-react';
import { generateFromString } from 'openapi-2-kong';
import { NoticeTable } from 'insomnia-components';
import { Spectral } from '@stoplight/spectral';
import 'swagger-ui-react/swagger-ui.css';

const spectral = new Spectral();

type Props = {|
  apiSpec: ApiSpec,
  workspace: Workspace,
  editorFontSize: number,
  editorIndentSize: number,
  lineWrapping: boolean,
  editorKeyMap: string,
  onChange: (spec: ApiSpec) => Promise<void>,
  handleTest: () => void,
|};

type State = {|
  previewActive: boolean,
  lintMessages: Array<{
    message: string,
    line: number,
    type: 'error' | 'warning',
  }>,
|};

@autobind
class SpecEditor extends React.PureComponent<Props, State> {
  editor: ?CodeEditor;
  debounceTimeout: IntervalID;

  state = {
    previewActive: true,
    lintMessages: [],
  };

  // Defining it here instead of in render() so it won't act as a changed prop
  // when being passed to <CodeEditor> again
  static lintOptions = {
    delay: 1000,
  };

  _setEditorRef(n: ?CodeEditor) {
    this.editor = n;
  }

  async _showGenerateConfig() {
    const { apiSpec } = this.props;
    let kongConfig;

    try {
      kongConfig = await generateFromString(apiSpec.contents);
    } catch (err) {
      showError({
        title: 'Error Generating',
        error: err.message,
        message: 'Failed to generate Kong declarative config',
      });
      return;
    }

    showModal(CodePromptModal, {
      submitName: 'Done',
      title: `Kong Declarative Config`,
      defaultValue: YAML.stringify(kongConfig),
      placeholder: '',
      mode: 'yaml',
      hideMode: true,
      showCopyButton: true,
    });
  }

  _togglePreview() {
    this.setState({ previewActive: !this.state.previewActive });
  }

  _handleOnChange(v: string) {
    const { apiSpec, onChange } = this.props;

    // Debounce the update because these specs can get pretty large
    clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(async () => {
      await onChange({ ...apiSpec, contents: v });
    }, 500);
  }

  setSelection(chStart: number, chEnd: number, lineStart: number, lineEnd: number) {
    const editor = this.editor;

    if (!editor) {
      return;
    }

    editor.setSelection(chStart, chEnd, lineStart, lineEnd);
  }

  _handleLintClick(notice: {}) {
    const { start, end } = notice._range;
    this.setSelection(start.character, end.character, start.line, end.line);
  }

  async _reLint() {
    const { apiSpec } = this.props;
    const results = await spectral.run(apiSpec.contents);

    this.setState({
      lintMessages: results.map(r => ({
        type: r.severity === 0 ? 'error' : 'warning',
        message: `${r.code} ${r.message}`,
        line: r.range.start.line,

        // Attach range that will be returned to our click handler
        _range: r.range,
      })),
    });
  }

  componentDidMount() {
    this._reLint();
  }

  componentDidUpdate(prevProps: Props) {
    const { apiSpec } = this.props;

    // Re-lint if content changed
    if (apiSpec.contents !== prevProps.apiSpec.contents) {
      this._reLint();
    }
  }

  render() {
    const {
      editorFontSize,
      editorIndentSize,
      lineWrapping,
      editorKeyMap,
      apiSpec,
      handleTest,
    } = this.props;

    const {
      lintMessages,
    } = this.state;

    let swaggerSpec;
    try {
      swaggerSpec = YAML.parse(apiSpec.contents) || {};
    } catch (err) {
      swaggerSpec = {};
    }

    return (
      <div
        className={'spec-editor theme--pane ' + (this.state.previewActive ? '' : 'previewHidden')}>
        <div className="spec-editor__header theme--pane__header">
          <h1>
            Edit API Specification <HelpLink slug="editing-specs" />
          </h1>
          <nav className="spec-editor__header__buttons">
            <button className="btn" onClick={this._togglePreview}>
              <i className={'fa ' + (this.state.previewActive ? 'fa-eye' : 'fa-eye-slash')} />{' '}
              Toggle Preview
            </button>
            <button className="btn" onClick={this._showGenerateConfig}>
              <i className="fa fa-code" /> Generate Config
            </button>
            <button className="btn" onClick={handleTest}>
              <i className="fa fa-cogs" /> Generate Requests
            </button>
          </nav>
        </div>
        <div id="swagger-ui-wrapper">
          <SwaggerUI spec={swaggerSpec} />
        </div>
        <div className="spec-editor__body theme--pane__body">
          <CodeEditor
            manualPrettify
            ref={this._setEditorRef}
            fontSize={editorFontSize}
            indentSize={editorIndentSize}
            lineWrapping={lineWrapping}
            keyMap={editorKeyMap}
            lintOptions={SpecEditor.lintOptions}
            mode="openapi"
            defaultValue={apiSpec.contents}
            onChange={this._handleOnChange}
            uniquenessKey={apiSpec._id}
          />
          {lintMessages.length > 0 && (
            <NoticeTable
              notices={lintMessages}
              onClick={this._handleLintClick}
            />
          )}
        </div>
      </div>
    );
  }
}

export default SpecEditor;

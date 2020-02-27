// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import type { WrapperProps } from './wrapper';
import PageLayout from './page-layout';
import { AppHeader, NoticeTable } from 'insomnia-components';
import ErrorBoundary from './error-boundary';
import SpecEditorSidebar from './spec-editor/spec-editor-sidebar';
import CodeEditor from './codemirror/code-editor';
import { Spectral } from '@stoplight/spectral';
import { showModal } from './modals';
import GenerateConfigModal from './modals/generate-config-modal';
import classnames from 'classnames';
import SwaggerUI from 'swagger-ui-react';
import YAML from 'yaml';
import { ACTIVITY_HOME } from './activity-bar/activity-bar';
import type { ApiSpec } from '../../models/api-spec';

const spectral = new Spectral();

type Props = {|
  gitSyncDropdown: React.Node,
  wrapperProps: WrapperProps,
  handleUpdateApiSpec: (s: ApiSpec) => any,
  handleDebugSpec: (s: ApiSpec) => any,
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
class WrapperDesign extends React.PureComponent<Props, State> {
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

  async _handleGenerateConfig() {
    const { activeApiSpec } = this.props.wrapperProps;
    showModal(GenerateConfigModal, { apiSpec: activeApiSpec });
  }

  _handleDebugSpec() {
    const { handleDebugSpec, wrapperProps: { activeApiSpec } } = this.props;
    handleDebugSpec(activeApiSpec);
  }

  _handleTogglePreview() {
    this.setState({ previewActive: !this.state.previewActive });
  }

  _handleOnChange(v: string) {
    const { wrapperProps: { activeApiSpec }, handleUpdateApiSpec } = this.props;
    console.log('PROPS', this.props);

    // Debounce the update because these specs can get pretty large
    clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(async () => {
      await handleUpdateApiSpec({ ...activeApiSpec, contents: v });
    }, 500);
  }

  _handleSetSelection(chStart: number, chEnd: number, lineStart: number, lineEnd: number) {
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
    const { activeApiSpec } = this.props.wrapperProps;
    const results = await spectral.run(activeApiSpec.contents);

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

  _handleBreadcrumb(index: number) {
    if (index === 0) {
      this.props.wrapperProps.handleSetActiveActivity(ACTIVITY_HOME);
    }
  }

  componentDidMount() {
    this._reLint();
  }

  componentDidUpdate(prevProps: Props) {
    const { activeApiSpec } = this.props.wrapperProps;

    // Re-lint if content changed
    if (activeApiSpec.contents !== prevProps.wrapperProps.activeApiSpec.contents) {
      this._reLint();
    }
  }

  render() {
    const {
      activeApiSpec,
      activeWorkspace,
      gitSyncDropdown,
      settings,
    } = this.props.wrapperProps;

    const {
      lintMessages,
      previewActive,
    } = this.state;

    let swaggerSpec;
    try {
      swaggerSpec = YAML.parse(activeApiSpec.contents) || {};
    } catch (err) {
      swaggerSpec = {};
    }

    return (
      <PageLayout
        wrapperProps={this.props.wrapperProps}
        renderPageHeader={() => (
          <AppHeader
            className="app-header"
            breadcrumbs={['Documents', activeWorkspace.name]}
            onBreadcrumb={this._handleBreadcrumb}
            menu={(
              <React.Fragment>
                <button className="btn btn--clicky-small" onClick={this._handleDebugSpec}>
                  Design <i className="fa fa-toggle-off"/> Test
                </button>
                <button className="btn btn--clicky-small" onClick={this._handleTogglePreview}>
                  {previewActive ? 'Hide Preview' : 'Show Preview'}
                </button>
                <button className="btn btn--clicky-small" onClick={this._handleGenerateConfig}>
                  Generate Config
                </button>
                {gitSyncDropdown}
              </React.Fragment>
            )}
          />
        )}
        renderPageBody={() => (
          <div
            className={classnames('spec-editor layout-body--sidebar theme--pane', {
              'preview-hidden': !previewActive,
            })}>
            <div id="swagger-ui-wrapper">
              <SwaggerUI spec={swaggerSpec} />
            </div>
            <div className="spec-editor__body theme--pane__body">
              <CodeEditor
                manualPrettify
                ref={this._setEditorRef}
                fontSize={settings.editorFontSize}
                indentSize={settings.editorIndentSize}
                lineWrapping={settings.lineWrapping}
                keyMap={settings.editorKeyMap}
                lintOptions={WrapperDesign.lintOptions}
                mode="openapi"
                defaultValue={activeApiSpec.contents}
                onChange={this._handleOnChange}
                uniquenessKey={activeApiSpec._id}
              />
              {lintMessages.length > 0 && (
                <NoticeTable
                  notices={lintMessages}
                  onClick={this._handleLintClick}
                />
              )}
            </div>
          </div>
        )}
        renderPageSidebar={() => (
          <ErrorBoundary showAlert>
            <SpecEditorSidebar
              apiSpec={activeApiSpec}
              handleSetSelection={this._handleSetSelection}
            />
          </ErrorBoundary>
        )}
      />
    );
  }
}

export default WrapperDesign;

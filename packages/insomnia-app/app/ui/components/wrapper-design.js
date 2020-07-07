// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import type { WrapperProps } from './wrapper';
import PageLayout from './page-layout';
import { Breadcrumb, Button, Header, NoticeTable } from 'insomnia-components';
import ErrorBoundary from './error-boundary';
import SpecEditorSidebar from './spec-editor/spec-editor-sidebar';
import CodeEditor from './codemirror/code-editor';
import { Spectral } from '@stoplight/spectral';
import { showModal } from './modals';
import GenerateConfigModal from './modals/generate-config-modal';
import classnames from 'classnames';
import SwaggerUI from 'swagger-ui-react';
import type { ApiSpec } from '../../models/api-spec';
import designerLogo from '../images/insomnia-designer-logo.svg';
import previewIcon from '../images/icn-eye.svg';
import generateConfigIcon from '../images/icn-gear.svg';
import * as models from '../../models/index';
import { parseApiSpec } from '../../common/api-specs';
import { getConfigGenerators } from '../../plugins';
import type { GlobalActivity } from '../../common/constants';
import { ACTIVITY_HOME } from '../../common/constants';
import ActivityToggle from './activity-toggle';

const spectral = new Spectral();

type Props = {|
  gitSyncDropdown: React.Node,
  handleActivityChange: (workspaceId: string, activity: GlobalActivity) => Promise<void>,
  handleUpdateApiSpec: (s: ApiSpec) => Promise<void>,
  wrapperProps: WrapperProps,
|};

type State = {|
  previewHidden: boolean,
  hasConfigPlugins: boolean,
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

  constructor(props: Props) {
    super(props);

    this.state = {
      previewHidden: props.wrapperProps.activeWorkspaceMeta.previewHidden || false,
      lintMessages: [],
      hasConfigPlugins: false,
    };
  }

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

  async _handleTogglePreview() {
    await this.setState(
      prevState => ({ previewHidden: !prevState.previewHidden }),
      async () => {
        const workspaceId = this.props.wrapperProps.activeWorkspace._id;
        const previewHidden = this.state.previewHidden;
        await models.workspaceMeta.updateByParentId(workspaceId, { previewHidden });
      },
    );
  }

  _handleOnChange(v: string) {
    const {
      wrapperProps: { activeApiSpec },
      handleUpdateApiSpec,
    } = this.props;

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
    // TODO: Export Notice from insomnia-components and use here, instead of {}
    const { start, end } = notice._range;
    this._handleSetSelection(start.character, end.character, start.line, end.line);
  }

  async _reLint() {
    const { activeApiSpec } = this.props.wrapperProps;

    // Lint only if spec has content
    if (activeApiSpec.contents.length !== 0) {
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
    } else {
      this.setState({
        lintMessages: [],
      });
    }
  }

  _handleBreadcrumb() {
    this.props.wrapperProps.handleSetActiveActivity(ACTIVITY_HOME);
  }

  async componentDidMount() {
    const generateConfigPlugins = await getConfigGenerators();
    this.setState({ hasConfigPlugins: generateConfigPlugins.length > 0 });

    await this._reLint();
  }

  componentDidUpdate(prevProps: Props) {
    const { activeApiSpec } = this.props.wrapperProps;

    // Re-lint if content changed
    if (activeApiSpec.contents !== prevProps.wrapperProps.activeApiSpec.contents) {
      this._reLint();
    }
  }

  render() {
    const { gitSyncDropdown, wrapperProps, handleActivityChange } = this.props;

    const { activeApiSpec, settings, activity, activeWorkspace } = wrapperProps;

    const { lintMessages, previewHidden, hasConfigPlugins } = this.state;

    let swaggerUiSpec;
    try {
      swaggerUiSpec = parseApiSpec(activeApiSpec.contents).contents;
    } catch (err) {}

    if (!swaggerUiSpec) {
      swaggerUiSpec = {};
    }

    return (
      <PageLayout
        wrapperProps={this.props.wrapperProps}
        renderPageHeader={() => (
          <Header
            className="app-header"
            gridLeft={
              <React.Fragment>
                <img src={designerLogo} alt="Insomnia" width="32" height="32" />
                <Breadcrumb
                  className="breadcrumb"
                  crumbs={['Documents', activeApiSpec.fileName]}
                  onClick={this._handleBreadcrumb}
                />
              </React.Fragment>
            }
            gridCenter={
              <ActivityToggle
                activity={activity}
                handleActivityChange={handleActivityChange}
                workspace={activeWorkspace}
              />
            }
            gridRight={
              <React.Fragment>
                <Button variant="contained" onClick={this._handleTogglePreview}>
                  <img src={previewIcon} alt="Preview" width="15" />
                  &nbsp; {previewHidden ? 'Preview: Off' : 'Preview: On'}
                </Button>
                {hasConfigPlugins && (
                  <Button
                    variant="contained"
                    onClick={this._handleGenerateConfig}
                    className="margin-left">
                    <img src={generateConfigIcon} alt="Generate Config" width="15" />
                    &nbsp; Generate Config
                  </Button>
                )}
                {gitSyncDropdown}
              </React.Fragment>
            }
          />
        )}
        renderPageBody={() => (
          <div
            className={classnames('spec-editor layout-body--sidebar theme--pane', {
              'preview-hidden': previewHidden,
            })}>
            <div id="swagger-ui-wrapper">
              <ErrorBoundary
                invalidationKey={activeApiSpec.contents}
                renderError={() => (
                  <div className="text-center margin">
                    <h3>An error occurred while trying to render Swagger UI 😢</h3>
                    This preview will automatically refresh, once you have a valid specification
                    that can be previewed.
                  </div>
                )}>
                <SwaggerUI
                  spec={swaggerUiSpec}
                  supportedSubmitMethods={[
                    'get',
                    'put',
                    'post',
                    'delete',
                    'options',
                    'head',
                    'patch',
                    'trace',
                  ]}
                />
              </ErrorBoundary>
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
                <NoticeTable notices={lintMessages} onClick={this._handleLintClick} />
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

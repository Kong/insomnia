// @flow
import * as React from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import type { WrapperProps } from './wrapper';
import PageLayout from './page-layout';
import { Button, NoticeTable } from 'insomnia-components';
import ErrorBoundary from './error-boundary';
import SpecEditorSidebar from './spec-editor/spec-editor-sidebar';
import CodeEditor from './codemirror/code-editor';
import { Spectral } from '@stoplight/spectral';
import { showModal } from './modals';
import GenerateConfigModal from './modals/generate-config-modal';
import SwaggerUI from 'swagger-ui-react';
import type { ApiSpec } from '../../models/api-spec';
import previewIcon from '../images/icn-eye.svg';
import generateConfigIcon from '../images/icn-gear.svg';
import * as models from '../../models/index';
import { parseApiSpec } from '../../common/api-specs';
import { getConfigGenerators } from '../../plugins';
import type { GlobalActivity } from '../../common/constants';
import { ACTIVITY_HOME, AUTOBIND_CFG } from '../../common/constants';
import WorkspacePageHeader from './workspace-page-header';

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

@autoBindMethodsForReact(AUTOBIND_CFG)
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

    editor.scrollToSelection(chStart, chEnd, lineStart, lineEnd);
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

  _renderEditor(): React.Node {
    const { activeApiSpec, settings } = this.props.wrapperProps;
    const { lintMessages } = this.state;

    return (
      <div className="column tall theme--pane__body">
        <div className="tall">
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
        </div>
        {lintMessages.length > 0 && (
          <NoticeTable notices={lintMessages} onClick={this._handleLintClick} />
        )}
      </div>
    );
  }

  _renderPreview(): React.Node {
    const { activeApiSpec } = this.props.wrapperProps;
    const { previewHidden } = this.state;

    if (previewHidden) {
      return null;
    }

    let swaggerUiSpec;
    try {
      swaggerUiSpec = parseApiSpec(activeApiSpec.contents).contents;
    } catch (err) {}

    if (!swaggerUiSpec) {
      swaggerUiSpec = {};
    }

    return (
      <div id="swagger-ui-wrapper">
        <ErrorBoundary
          invalidationKey={activeApiSpec.contents}
          renderError={() => (
            <div className="text-left margin pad">
              <h3>An error occurred while trying to render Swagger UI 😢</h3>
              <p>
                This preview will automatically refresh, once you have a valid specification that
                can be previewed.
              </p>
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
    );
  }

  _renderPageHeader() {
    const { wrapperProps, gitSyncDropdown, handleActivityChange } = this.props;
    const { previewHidden, hasConfigPlugins } = this.state;

    return (
      <WorkspacePageHeader
        wrapperProps={wrapperProps}
        handleActivityChange={handleActivityChange}
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
    );
  }

  _renderPageSidebar() {
    const { activeApiSpec } = this.props.wrapperProps;

    return (
      <ErrorBoundary
        invalidationKey={activeApiSpec.contents}
        renderError={() => (
          <div className="text-left margin pad">
            <h4>An error occurred while trying to render your spec's navigation. 😢</h4>
            <p>
              This navigation will automatically refresh, once you have a valid specification that
              can be rendered.
            </p>
          </div>
        )}>
        <SpecEditorSidebar apiSpec={activeApiSpec} handleSetSelection={this._handleSetSelection} />
      </ErrorBoundary>
    );
  }

  render() {
    return (
      <PageLayout
        wrapperProps={this.props.wrapperProps}
        renderPageHeader={this._renderPageHeader}
        renderPaneOne={this._renderEditor}
        renderPaneTwo={this._renderPreview}
        renderPageSidebar={this._renderPageSidebar}
      />
    );
  }
}

export default WrapperDesign;

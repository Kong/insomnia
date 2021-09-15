import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { Button, NoticeTable } from 'insomnia-components';
import React, { Fragment, PureComponent, ReactNode } from 'react';
import SwaggerUI from 'swagger-ui-react';

import { parseApiSpec, ParsedApiSpec } from '../../common/api-specs';
import type { GlobalActivity } from '../../common/constants';
import { ACTIVITY_HOME, AUTOBIND_CFG } from '../../common/constants';
import { initializeSpectral, isLintError } from '../../common/spectral';
import type { ApiSpec } from '../../models/api-spec';
import * as models from '../../models/index';
import previewIcon from '../images/icn-eye.svg';
import CodeEditor, { UnconnectedCodeEditor } from './codemirror/code-editor';
import ErrorBoundary from './error-boundary';
import PageLayout from './page-layout';
import SpecEditorSidebar from './spec-editor/spec-editor-sidebar';
import WorkspacePageHeader from './workspace-page-header';
import type { WrapperProps } from './wrapper';

const spectral = initializeSpectral();

interface Props {
  gitSyncDropdown: ReactNode;
  handleActivityChange: (options: {workspaceId?: string; nextActivity: GlobalActivity}) => Promise<void>;
  handleUpdateApiSpec: (s: ApiSpec) => Promise<void>;
  wrapperProps: WrapperProps;
}

interface State {
  lintMessages: {
    message: string;
    line: number;
    type: 'error' | 'warning';
  }[];
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class WrapperDesign extends PureComponent<Props, State> {
  editor: UnconnectedCodeEditor | null = null;
  debounceTimeout: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      lintMessages: [],
    };
  }

  // Defining it here instead of in render() so it won't act as a changed prop
  // when being passed to <CodeEditor> again
  static lintOptions = {
    delay: 1000,
  };

  _setEditorRef(n: UnconnectedCodeEditor) {
    this.editor = n;
  }

  async _handleTogglePreview() {
    const { activeWorkspace } = this.props.wrapperProps;

    if (!activeWorkspace) {
      return;
    }

    const workspaceId = activeWorkspace._id;
    const previewHidden = Boolean(this.props.wrapperProps.activeWorkspaceMeta?.previewHidden);
    await models.workspaceMeta.updateByParentId(workspaceId, { previewHidden: !previewHidden });
  }

  _handleOnChange(v: string) {
    const {
      wrapperProps: { activeApiSpec },
      handleUpdateApiSpec,
    } = this.props;

    if (!activeApiSpec) {
      return;
    }

    // TODO: this seems strange, should the timeout be set and cleared on every change??
    // Debounce the update because these specs can get pretty large
    if (this.debounceTimeout !== null) {
      clearTimeout(this.debounceTimeout);
    }

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

  _handleLintClick(notice) {
    // TODO: Export Notice from insomnia-components and use here, instead of {}
    const { start, end } = notice._range;

    this._handleSetSelection(start.character, end.character, start.line, end.line);
  }

  async _reLint() {
    const { activeApiSpec } = this.props.wrapperProps;

    // Lint only if spec has content
    if (activeApiSpec && activeApiSpec.contents.length !== 0) {
      const results = (await spectral.run(activeApiSpec.contents)).filter(isLintError);
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
    await this._reLint();
  }

  componentDidUpdate(prevProps: Props) {
    const { activeApiSpec } = this.props.wrapperProps;

    // Re-lint if content changed
    if (activeApiSpec?.contents !== prevProps.wrapperProps.activeApiSpec?.contents) {
      this._reLint();
    }
  }

  _renderEditor() {
    const { activeApiSpec, settings } = this.props.wrapperProps;
    const { lintMessages } = this.state;

    if (!activeApiSpec) {
      return null;
    }

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

  _renderPreview() {
    const { activeApiSpec, activeWorkspaceMeta } = this.props.wrapperProps;

    if (!activeApiSpec || activeWorkspaceMeta?.previewHidden) {
      return null;
    }

    let swaggerUiSpec: ParsedApiSpec['contents'] | null = null;

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
          )}
        >
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
    const previewHidden = Boolean(wrapperProps.activeWorkspaceMeta?.previewHidden);
    return (
      <WorkspacePageHeader
        wrapperProps={wrapperProps}
        handleActivityChange={handleActivityChange}
        gridRight={
          <Fragment>
            <Button variant="contained" onClick={this._handleTogglePreview}>
              <img src={previewIcon} alt="Preview" width="15" />
              &nbsp; {previewHidden ? 'Preview: Off' : 'Preview: On'}
            </Button>
            {gitSyncDropdown}
          </Fragment>
        }
      />
    );
  }

  _renderPageSidebar() {
    const { activeApiSpec } = this.props.wrapperProps;

    if (!activeApiSpec) {
      return null;
    }

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
        )}
      >
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

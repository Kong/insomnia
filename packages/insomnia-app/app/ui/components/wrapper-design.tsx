import { IRuleResult } from '@stoplight/spectral';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { Button, Notice, NoticeTable } from 'insomnia-components';
import React, { createRef, FC, Fragment, PureComponent, ReactNode, RefObject, useCallback, useState } from 'react';
import { useAsync, useDebounce } from 'react-use';
import styled from 'styled-components';
import SwaggerUI from 'swagger-ui-react';

import { parseApiSpec, ParsedApiSpec } from '../../common/api-specs';
import type { GlobalActivity } from '../../common/constants';
import { AUTOBIND_CFG } from '../../common/constants';
import { initializeSpectral, isLintError } from '../../common/spectral';
import type { ApiSpec } from '../../models/api-spec';
import * as models from '../../models/index';
import { superFaint } from '../css/css-in-js';
import previewIcon from '../images/icn-eye.svg';
import { CodeEditor,  UnconnectedCodeEditor } from './codemirror/code-editor';
import { DesignEmptyState } from './design-empty-state';
import { ErrorBoundary } from './error-boundary';
import { PageLayout } from './page-layout';
import { SpecEditorSidebar } from './spec-editor/spec-editor-sidebar';
import { WorkspacePageHeader } from './workspace-page-header';
import type { WrapperProps } from './wrapper';

const EmptySpaceHelper = styled.div({
  ...superFaint,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '2em',
  textAlign: 'center',
});

const spectral = initializeSpectral();

const RenderPageHeader: FC<Pick<Props,
| 'gitSyncDropdown'
| 'handleActivityChange'
| 'wrapperProps'
>> = ({
  gitSyncDropdown,
  handleActivityChange,
  wrapperProps,
}) => {
  const { activeWorkspace, activeWorkspaceMeta } = wrapperProps;
  const previewHidden = Boolean(activeWorkspaceMeta?.previewHidden);

  const handleTogglePreview = useCallback(async () => {
    if (!activeWorkspace) {
      return;
    }

    const workspaceId = activeWorkspace._id;
    await models.workspaceMeta.updateByParentId(workspaceId, { previewHidden: !previewHidden });
  }, [activeWorkspace, previewHidden]);

  return (
    <WorkspacePageHeader
      wrapperProps={wrapperProps}
      handleActivityChange={handleActivityChange}
      gridRight={
        <Fragment>
          <Button variant="contained" onClick={handleTogglePreview}>
            <img src={previewIcon} alt="Preview" width="15" />
            &nbsp; {previewHidden ? 'Preview: Off' : 'Preview: On'}
          </Button>
          {gitSyncDropdown}
        </Fragment>
      }
    />
  );
};

interface LintMessage {
  message: string;
  line: number;
  type: 'error' | 'warning';
  range: IRuleResult['range'];
}

const RenderEditor: FC<Pick<Props,
  | 'wrapperProps'
  | 'handleUpdateApiSpec'
> & {
  editor: RefObject<UnconnectedCodeEditor>;
}> = ({
  editor,
  handleUpdateApiSpec,
  wrapperProps,
}) => {
  const { activeApiSpec } = wrapperProps;
  const [forceRefreshCounter, setForceRefreshCounter] = useState(0);
  const [lintMessages, setLintMessages] = useState<LintMessage[]>([]);
  const [contentsState, setContentsState] = useState(activeApiSpec?.contents ?? '');

  const uniquenessKey = `${forceRefreshCounter}::${activeApiSpec?._id}`;

  const onUpdateContents = useCallback(() => {
    setForceRefreshCounter(forceRefreshCounter + 1);
  }, [forceRefreshCounter]);

  useDebounce(async (contents: string) => {
    if (!activeApiSpec) {
      return;
    }

    await handleUpdateApiSpec({ ...activeApiSpec, contents });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- this is a problem with react-use
  }, 500, [contentsState]);

  const contents = activeApiSpec?.contents;

  useAsync(async () => {
    // Lint only if spec has content
    if (contents && contents.length !== 0) {
      const results: LintMessage[] = (await spectral.run(contents))
        .filter(isLintError)
        .map(({ severity, code, message, range }) => ({
          type: severity === 0 ? 'error' : 'warning',
          message: `${code} ${message}`,
          line: range.start.line,
          // Attach range that will be returned to our click handler
          range,
        }));
      setLintMessages(results);
    } else {
      setLintMessages([]);
    }
  }, [contents]);

  const handleScrollToSelection = useCallback((notice: Notice<Pick<LintMessage, 'range'>>) => {
    if (!editor.current) {
      return;
    }
    if (!notice.range) {
      return;
    }
    const { start, end } = notice.range;
    editor.current.scrollToSelection(start.character, end.character, start.line, end.line);
  }, [editor]);

  if (!activeApiSpec) {
    return null;
  }

  return (
    <div className="column tall theme--pane__body">
      <div className="tall relative overflow-hidden">
        <CodeEditor
          manualPrettify
          ref={editor}
          lintOptions={{ delay: 1000 }}
          mode="openapi"
          defaultValue={activeApiSpec.contents}
          onChange={setContentsState}
          uniquenessKey={uniquenessKey}
        />
        <DesignEmptyState
          onUpdateContents={onUpdateContents}
        />
      </div>
      {lintMessages.length > 0 && (
        <NoticeTable<Pick<LintMessage, 'range'>>
          notices={lintMessages}
          onClick={handleScrollToSelection}
        />
      )}
    </div>
  );
};

const RenderPreview: FC<Pick<Props, 'wrapperProps'>> = ({ wrapperProps }) => {
  const { activeApiSpec, activeWorkspaceMeta } = wrapperProps;

  if (!activeApiSpec || activeWorkspaceMeta?.previewHidden) {
    return null;
  }

  if (!activeApiSpec.contents) {
    return (
      <EmptySpaceHelper>
        Documentation for your OpenAPI spec will render here
      </EmptySpaceHelper>
    );
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
            <h3>An error occurred while trying to render Swagger UI</h3>
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
};

interface Props {
  gitSyncDropdown: ReactNode;
  handleActivityChange: (options: {workspaceId?: string; nextActivity: GlobalActivity}) => Promise<void>;
  handleUpdateApiSpec: (apiSpec: ApiSpec) => Promise<void>;
  wrapperProps: WrapperProps;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class WrapperDesign extends PureComponent<Props> {
  editor = createRef<UnconnectedCodeEditor>();

  handleScrollToSelection(chStart: number, chEnd: number, lineStart: number, lineEnd: number) {
    if (!this.editor.current) {
      return;
    }
    this.editor.current.scrollToSelection(chStart, chEnd, lineStart, lineEnd);
  }

  _renderPageSidebar() {
    const { activeApiSpec } = this.props.wrapperProps;

    if (!activeApiSpec) {
      return null;
    }

    if (!activeApiSpec.contents) {
      return (
        <EmptySpaceHelper>
          A spec navigator will render here
        </EmptySpaceHelper>
      );
    }

    return (
      <ErrorBoundary
        invalidationKey={activeApiSpec.contents}
        renderError={() => (
          <div className="text-left margin pad">
            <h4>An error occurred while trying to render your spec's navigation.</h4>
            <p>
              This navigation will automatically refresh, once you have a valid specification that
              can be rendered.
            </p>
          </div>
        )}
      >
        <SpecEditorSidebar
          apiSpec={activeApiSpec}
          handleSetSelection={this.handleScrollToSelection}
        />
      </ErrorBoundary>
    );
  }

  render() {
    const {
      gitSyncDropdown,
      handleActivityChange,
      handleUpdateApiSpec,
      wrapperProps,
    } = this.props;

    const renderPageHeader = () => (
      <RenderPageHeader
        gitSyncDropdown={gitSyncDropdown}
        handleActivityChange={handleActivityChange}
        wrapperProps={wrapperProps}
      />
    );

    const renderEditor = () => (
      <RenderEditor
        editor={this.editor}
        handleUpdateApiSpec={handleUpdateApiSpec}
        wrapperProps={wrapperProps}
      />
    );

    const renderPreview = () => (
      <RenderPreview
        wrapperProps={wrapperProps}
      />
    );

    return (
      <PageLayout
        wrapperProps={this.props.wrapperProps}
        renderPageHeader={renderPageHeader}
        renderPaneOne={renderEditor}
        renderPaneTwo={renderPreview}
        renderPageSidebar={this._renderPageSidebar}
      />
    );
  }
}

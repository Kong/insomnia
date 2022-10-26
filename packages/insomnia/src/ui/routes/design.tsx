import 'swagger-ui-react/swagger-ui.css';

import { IRuleResult } from '@stoplight/spectral-core';
import React, { createRef, FC, RefObject, useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import SwaggerUI from 'swagger-ui-react';

import { parseApiSpec, ParsedApiSpec } from '../../common/api-specs';
import { database } from '../../common/database';
import { debounce } from '../../common/misc';
import { initializeSpectral, isLintError } from '../../common/spectral';
import * as models from '../../models/index';
import { CodeEditor, CodeEditorHandle } from '../components/codemirror/code-editor';
import { DesignEmptyState } from '../components/design-empty-state';
import { ErrorBoundary } from '../components/error-boundary';
import { Notice, NoticeTable } from '../components/notice-table';
import { PageLayout } from '../components/page-layout';
import { SpecEditorSidebar } from '../components/spec-editor/spec-editor-sidebar';
import { WorkspacePageHeader } from '../components/workspace-page-header';
import { superFaint } from '../css/css-in-js';
import { useActiveApiSpecSyncVCSVersion, useGitVCSVersion } from '../hooks/use-vcs-version';
import { selectActiveApiSpec } from '../redux/selectors';

const EmptySpaceHelper = styled.div({
  ...superFaint,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '2em',
  textAlign: 'center',
});

// TODO(jackkav): find the right place to do this
const spectral = initializeSpectral();

interface LintMessage extends Notice {
  range: IRuleResult['range'];
}

const RenderEditor: FC<{ editor: RefObject<CodeEditorHandle> }> = ({ editor }) => {
  const activeApiSpec = useSelector(selectActiveApiSpec);
  const [lintMessages, setLintMessages] = useState<LintMessage[]>([]);
  const contents = activeApiSpec?.contents ?? '';
  const gitVersion = useGitVCSVersion();
  const syncVersion = useActiveApiSpecSyncVCSVersion();

  const onImport = useCallback(async (value: string) => {
    if (!activeApiSpec) {
      return;
    }

    await database.update({ ...activeApiSpec, modified: Date.now(), created: Date.now(), contents: value }, true);
  }, [activeApiSpec]);

  const uniquenessKey = `${activeApiSpec?._id}::${activeApiSpec?.created}::${gitVersion}::${syncVersion}`;
  const onCodeEditorChange = useMemo(() => {
    const handler = async (contents: string) => {
      if (!activeApiSpec) {
        return;
      }

      await models.apiSpec.update({ ...activeApiSpec, contents });
    };

    return debounce(handler, 500);
  }, [activeApiSpec]);

  useEffect(() => {
    let isMounted = true;
    const update = async () => {
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
        isMounted && setLintMessages(results);
      } else {
        isMounted && setLintMessages([]);
      }
    };
    update();

    return () => {
      isMounted = false;
    };
  }, [contents]);

  const handleScrollToSelection = useCallback((notice: LintMessage) => {
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
          key={uniquenessKey}
          manualPrettify
          ref={editor}
          lintOptions={{ delay: 1000 }}
          mode="openapi"
          defaultValue={contents}
          onChange={onCodeEditorChange}
          uniquenessKey={uniquenessKey}
        />
        {contents ? null : (
          <DesignEmptyState
            onImport={onImport}
          />
        )}
      </div>
      {lintMessages.length > 0 && (
        <NoticeTable
          notices={lintMessages}
          onClick={handleScrollToSelection}
        />
      )}
    </div>
  );
};

const RenderPreview: FC = () => {
  const activeApiSpec = useSelector(selectActiveApiSpec);

  if (!activeApiSpec) {
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
  } catch (err) { }

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

const RenderPageSidebar: FC<{ editor: RefObject<CodeEditorHandle> }> = ({ editor }) => {
  const activeApiSpec = useSelector(selectActiveApiSpec);
  const handleScrollToSelection = useCallback((chStart: number, chEnd: number, lineStart: number, lineEnd: number) => {
    if (!editor.current) {
      return;
    }
    editor.current.scrollToSelection(chStart, chEnd, lineStart, lineEnd);
  }, [editor]);

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
        handleSetSelection={handleScrollToSelection}
      />
    </ErrorBoundary>
  );
};

export const WrapperDesign: FC = () => {
  const editor = createRef<CodeEditorHandle>();

  return (
    <PageLayout
      renderPageHeader={(
        <WorkspacePageHeader />
      )}
      renderPaneOne={<RenderEditor editor={editor} />}
      renderPaneTwo={<RenderPreview />}
      renderPageSidebar={<RenderPageSidebar editor={editor} />}
    />
  );
};

export default WrapperDesign;

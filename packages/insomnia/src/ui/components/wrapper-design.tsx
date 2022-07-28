import { IRuleResult } from '@stoplight/spectral-core';
import { Notice, NoticeTable } from 'insomnia-components';
import React, { createRef, FC, ReactNode, RefObject, useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useAsync } from 'react-use';
import styled from 'styled-components';
import SwaggerUI from 'swagger-ui-react';

import { parseApiSpec, ParsedApiSpec } from '../../common/api-specs';
import { debounce } from '../../common/misc';
import { initializeSpectral, isLintError } from '../../common/spectral';
import * as models from '../../models/index';
import { superFaint } from '../css/css-in-js';
import { selectActiveApiSpec } from '../redux/selectors';
import { CodeEditor, UnconnectedCodeEditor } from './codemirror/code-editor';
import { DesignEmptyState } from './design-empty-state';
import { ErrorBoundary } from './error-boundary';
import { PageLayout } from './page-layout';
import { SpecEditorSidebar } from './spec-editor/spec-editor-sidebar';
import { WorkspacePageHeader } from './workspace-page-header';
import type { HandleActivityChange } from './wrapper';

const EmptySpaceHelper = styled.div({
  ...superFaint,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '2em',
  textAlign: 'center',
});

const spectral = initializeSpectral();

interface LintMessage extends Notice {
  range: IRuleResult['range'];
}

const useDesignEmptyState = () => {
  const activeApiSpec = useSelector(selectActiveApiSpec);
  const contents = activeApiSpec?.contents;

  const [forceRefreshCounter, setForceRefreshCounter] = useState(0);
  const [shouldIncrementCounter, setShouldIncrementCounter] = useState(false);

  useEffect(() => {
    if (contents && shouldIncrementCounter) {
      setForceRefreshCounter(forceRefreshCounter => forceRefreshCounter + 1);
      setShouldIncrementCounter(false);
    }
  }, [contents, shouldIncrementCounter]);

  const onUpdateContents = useCallback(async (value: string) => {
    if (!activeApiSpec) {
      return;
    }

    await models.apiSpec.update({ ...activeApiSpec, contents: value });

    // Because we can't await activeApiSpec.contents to have propageted to redux, we flip a toggle to decide if we should do something when redux does eventually change
    setShouldIncrementCounter(true);
  }, [activeApiSpec]);

  const emptyStateNode = contents ? null : (
    <DesignEmptyState
      onUpdateContents={onUpdateContents}
    />
  );

  const uniquenessKey = `${forceRefreshCounter}::${activeApiSpec?._id}`;
  return { uniquenessKey, emptyStateNode };
};

const RenderEditor: FC<{ editor: RefObject<UnconnectedCodeEditor> }> = ({ editor }) => {
  const activeApiSpec = useSelector(selectActiveApiSpec);
  const [lintMessages, setLintMessages] = useState<LintMessage[]>([]);
  const contents = activeApiSpec?.contents ?? '';

  const { uniquenessKey, emptyStateNode } = useDesignEmptyState();

  const onCodeEditorChange = useMemo(() => {
    const handler = async (contents: string) => {
      if (!activeApiSpec) {
        return;
      }

      await models.apiSpec.update({ ...activeApiSpec, contents });
    };

    return debounce(handler, 500);
  }, [activeApiSpec]);

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
          manualPrettify
          ref={editor}
          lintOptions={{ delay: 1000 }}
          mode="openapi"
          defaultValue={contents}
          onChange={onCodeEditorChange}
          uniquenessKey={uniquenessKey}
        />
        {emptyStateNode}
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

const RenderPageSidebar: FC<{ editor: RefObject<UnconnectedCodeEditor> }> = ({ editor }) => {
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

interface Props {
  gitSyncDropdown: ReactNode;
  handleActivityChange: HandleActivityChange;
}

export const WrapperDesign: FC<Props> = ({
  gitSyncDropdown,
  handleActivityChange,
}) => {
  const editor = createRef<UnconnectedCodeEditor>();

  return (
    <PageLayout
      renderPageHeader={(
        <WorkspacePageHeader
          handleActivityChange={handleActivityChange}
          gridRight={gitSyncDropdown}
        />
      )}
      renderPaneOne={<RenderEditor editor={editor} />}
      renderPaneTwo={<RenderPreview />}
      renderPageSidebar={<RenderPageSidebar editor={editor} />}
    />
  );
};

export default WrapperDesign;

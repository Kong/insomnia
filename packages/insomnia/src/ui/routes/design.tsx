import type { IRuleResult } from '@stoplight/spectral-core';
import React, { createRef, FC, useCallback, useMemo } from 'react';
import {
  LoaderFunction,
  useFetcher,
  useLoaderData,
  useParams,
} from 'react-router-dom';
import styled from 'styled-components';

import { ACTIVITY_SPEC } from '../../common/constants';
import { debounce } from '../../common/misc';
import { ApiSpec } from '../../models/api-spec';
import * as models from '../../models/index';
import { invariant } from '../../utils/invariant';
import {
  CodeEditor,
  CodeEditorHandle,
} from '../components/codemirror/code-editor';
import { DesignEmptyState } from '../components/design-empty-state';
import { ErrorBoundary } from '../components/error-boundary';
import { Notice, NoticeTable } from '../components/notice-table';
import { SidebarLayout } from '../components/sidebar-layout';
import { SpecEditorSidebar } from '../components/spec-editor/spec-editor-sidebar';
import { superFaint } from '../css/css-in-js';
import {
  useActiveApiSpecSyncVCSVersion,
  useGitVCSVersion,
} from '../hooks/use-vcs-version';

const isLintError = (result: IRuleResult) => result.severity === 0;

const EmptySpaceHelper = styled.div({
  ...superFaint,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '2em',
  textAlign: 'center',
});

export const Toolbar = styled.div({
  boxSizing: 'content-box',
  position: 'sticky',
  top: 0,
  zIndex: 1,
  backgroundColor: 'var(--color-bg)',
  display: 'flex',
  justifyContent: 'flex-end',
  flexDirection: 'row',
  borderTop: '1px solid var(--hl-md)',
  height: 'var(--line-height-sm)',
  fontSize: 'var(--font-size-sm)',
  '& > button': {
    color: 'var(--hl)',
    padding: 'var(--padding-xs) var(--padding-xs)',
    height: '100%',
  },
});

interface LoaderData {
  lintMessages: LintMessage[];
  apiSpec: ApiSpec;
}

export const loader: LoaderFunction = async ({
  params,
}): Promise<LoaderData> => {
  const { workspaceId } = params;
  invariant(workspaceId, 'Workspace ID is required');
  const apiSpec = await models.apiSpec.getByParentId(workspaceId);
  invariant(apiSpec, 'API spec not found');

  let lintMessages: LintMessage[] = [];
  if (apiSpec.contents && apiSpec.contents.length !== 0) {
    lintMessages = (await window.main.spectralRun(apiSpec.contents))
      .filter(isLintError)
      .map(({ severity, code, message, range }) => ({
        type: severity === 0 ? 'error' : 'warning',
        message: `${code} ${message}`,
        line: range.start.line,
        // Attach range that will be returned to our click handler
        range,
      }));
  }

  return {
    lintMessages,
    apiSpec,
  };
};

interface LintMessage extends Notice {
  range: IRuleResult['range'];
}

const Design: FC = () => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const { apiSpec, lintMessages } = useLoaderData() as LoaderData;
  const editor = createRef<CodeEditorHandle>();

  const updateApiSpecFetcher = useFetcher();
  const generateRequestCollectionFetcher = useFetcher();

  const onCodeEditorChange = useMemo(() => {
    const handler = async (contents: string) => {
      updateApiSpecFetcher.submit(
        {
          contents: contents,
        },
        {
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/${ACTIVITY_SPEC}/update`,
          method: 'post',
        }
      );
    };

    return debounce(handler, 500);
  }, [organizationId, projectId, updateApiSpecFetcher, workspaceId]);

  const handleScrollToSelection = useCallback(
    (chStart: number, chEnd: number, lineStart: number, lineEnd: number) => {
      if (!editor.current) {
        return;
      }
      editor.current.scrollToSelection(chStart, chEnd, lineStart, lineEnd);
    },
    [editor]
  );

  const handleScrollToLintMessage = useCallback(
    (notice: LintMessage) => {
      if (!editor.current) {
        return;
      }
      if (!notice.range) {
        return;
      }
      const { start, end } = notice.range;
      editor.current.scrollToSelection(
        start.character,
        end.character,
        start.line,
        end.line
      );
    },
    [editor]
  );

  const gitVersion = useGitVCSVersion();
  const syncVersion = useActiveApiSpecSyncVCSVersion();
  const uniquenessKey = `${apiSpec?._id}::${apiSpec?.created}::${gitVersion}::${syncVersion}`;

  return (
    <SidebarLayout
      renderPageSidebar={
        apiSpec.contents ? (
          <ErrorBoundary
            invalidationKey={apiSpec.contents}
            renderError={() => (
              <div className="text-left margin pad">
                <h4>
                  An error occurred while trying to render your spec's
                  navigation.
                </h4>
                <p>
                  This navigation will automatically refresh, once you have a
                  valid specification that can be rendered.
                </p>
              </div>
            )}
          >
            <SpecEditorSidebar
              apiSpec={apiSpec}
              handleSetSelection={handleScrollToSelection}
            />
          </ErrorBoundary>
        ) : (
          <EmptySpaceHelper>A spec navigator will render here</EmptySpaceHelper>
        )
      }
      renderPaneOne={
        apiSpec ? (
          <div className="column tall theme--pane__body">
            <div className="tall relative overflow-hidden">
              <CodeEditor
                key={uniquenessKey}
                showPrettifyButton
                ref={editor}
                lintOptions={{ delay: 1000 }}
                mode="openapi"
                defaultValue={apiSpec.contents || ''}
                onChange={onCodeEditorChange}
                uniquenessKey={uniquenessKey}
              />
              {apiSpec.contents ? null : (
                <DesignEmptyState
                  onImport={value => {
                    updateApiSpecFetcher.submit(
                      {
                        contents: value,
                        fromSync: 'true',
                      },
                      {
                        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/${ACTIVITY_SPEC}/update`,
                        method: 'post',
                      }
                    );
                  }}
                />
              )}
            </div>
            {lintMessages.length > 0 && (
              <NoticeTable
                notices={lintMessages}
                onClick={handleScrollToLintMessage}
              />
            )}
            {apiSpec.contents ? (
              <Toolbar>
                <button
                  disabled={lintMessages.length > 0 || generateRequestCollectionFetcher.state !== 'idle'}
                  className="btn btn--compact"
                  onClick={() => {
                    generateRequestCollectionFetcher.submit(
                      {},
                      {
                        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/${ACTIVITY_SPEC}/generate-request-collection`,
                        method: 'post',
                      }
                    );
                  }}
                >
                  {generateRequestCollectionFetcher.state === 'loading' ? (
                    <i className="fa fa-spin fa-spinner" />
                  ) : (
                    <i className="fa fa-file-import" />
                  )} Generate Request
                  Collection
                </button>
              </Toolbar>
            ) : null}
          </div>
        ) : null
      }
    />
  );
};

export default Design;

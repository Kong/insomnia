import type { IRuleResult } from '@stoplight/spectral-core';
import CodeMirror from 'codemirror';
import { stat } from 'fs/promises';
import path from 'path';
import React, { createRef, FC, Fragment, useCallback, useEffect, useMemo } from 'react';
import {
  LoaderFunction,
  useFetcher,
  useLoaderData,
  useParams,
} from 'react-router-dom';
import { useToggle } from 'react-use';
import styled from 'styled-components';
import { SwaggerUIBundle } from 'swagger-ui-dist';

import { parseApiSpec } from '../../common/api-specs';
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
import { WorkspaceSyncDropdown } from '../components/dropdowns/workspace-sync-dropdown';
import { ErrorBoundary } from '../components/error-boundary';
import { Notice, NoticeTable } from '../components/notice-table';
import { SidebarLayout } from '../components/sidebar-layout';
import { SpecEditorSidebar } from '../components/spec-editor/spec-editor-sidebar';
import { Tooltip } from '../components/tooltip';
import {
  useActiveApiSpecSyncVCSVersion,
  useGitVCSVersion,
} from '../hooks/use-vcs-version';
const EmptySpaceHelper = styled.div({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  padding: '2em',
  textAlign: 'center',
  opacity: 'calc(var(--opacity-subtle) * 0.8)',
});

export const Toolbar = styled.div({
  boxSizing: 'content-box',
  position: 'sticky',
  top: 0,
  zIndex: 1,
  backgroundColor: 'var(--color-bg)',
  display: 'flex',
  justifyContent: 'space-between',
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

const RulesetLabel = styled.div({
  display: 'flex',
  alignItems: 'center',
  padding: 'var(--padding-md)',
  height: '100%',
  boxSizing: 'border-box',
  gap: 'var(--padding-sm)',
  color: 'var(--hl)',
});

interface LoaderData {
  lintMessages: LintMessage[];
  apiSpec: ApiSpec;
  rulesetPath: string;
}

export const loader: LoaderFunction = async ({
  params,
}): Promise<LoaderData> => {
  const { workspaceId } = params;
  invariant(workspaceId, 'Workspace ID is required');
  const apiSpec = await models.apiSpec.getByParentId(workspaceId);
  invariant(apiSpec, 'API spec not found');
  const workspace = await models.workspace.getById(workspaceId);
  invariant(workspace, 'Workspace not found');

  const workspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);

  let lintMessages: LintMessage[] = [];

  let rulesetPath = '';

  try {
    const spectralRulesetPath = path.join(
      process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'),
      `version-control/git/${workspaceMeta?.gitRepositoryId}/other/.spectral.yaml`,
    );

    if ((await stat(spectralRulesetPath)).isFile()) {
      rulesetPath = spectralRulesetPath;
    }
  } catch (err) {
    // Ignore
  }

  if (apiSpec.contents && apiSpec.contents.length !== 0) {
    try {
      lintMessages = (await window.main.spectralRun({
        contents: apiSpec.contents,
        rulesetPath,
      }))
        .map(({ severity, code, message, range }) => ({
          type: (['error', 'warning'][severity] ?? 'info') as Notice['type'],
          message: `${code} ${message}`,
          line: range.start.line,
          // Attach range that will be returned to our click handler
          range,
        }));
    } catch (e) {
      console.log('Error linting spec', e);
    }
  }

  return {
    lintMessages,
    apiSpec,
    rulesetPath,
  };
};

const SwaggerUIDiv = ({ text }: { text: string }) => {
  useEffect(() => {
    let spec = {};
    try {
      spec = parseApiSpec(text).contents || {};
    } catch (err) { }
    SwaggerUIBundle({ spec, dom_id: '#swagger-ui' });
  }, [text]);
  return <div
    id="swagger-ui"
    style={{
      overflowY: 'auto',
      height: '100%',
      background: '#FFF',
    }}
  />;
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
  const { apiSpec, lintMessages, rulesetPath } = useLoaderData() as LoaderData;
  const editor = createRef<CodeEditorHandle>();

  const updateApiSpecFetcher = useFetcher();
  const generateRequestCollectionFetcher = useFetcher();
  const [showRightPane, toggleRightPane] = useToggle(true);

  useEffect(() => {
    CodeMirror.registerHelper('lint', 'openapi', async (contents: string) => {
      const diagnostics = await window.main.spectralRun({
        contents,
        rulesetPath,
      });

      return diagnostics.map(result => ({
        from: CodeMirror.Pos(result.range.start.line, result.range.start.character),
        to: CodeMirror.Pos(result.range.end.line, result.range.end.character),
        message: result.message,
        severity: ['error', 'warning'][result.severity] ?? 'info',
      }));
    });
  }, [rulesetPath]);

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
            <div
              style={{
                gridRowStart: 6,
              }}
            >
              <WorkspaceSyncDropdown />
            </div>
          </ErrorBoundary>
        ) : (
          <Fragment>
            <EmptySpaceHelper>A spec navigator will render here</EmptySpaceHelper>
            <div
              style={{
                gridRowStart: 6,
              }}
            >
              <WorkspaceSyncDropdown />
            </div>
          </Fragment>
        )
      }
      renderPaneTwo={showRightPane && <SwaggerUIDiv text={apiSpec.contents} />}
      renderPaneOne={
        apiSpec ? (
          <div className="column tall theme--pane__body">
            <div className="tall relative overflow-hidden">
              <CodeEditor
                id="spec-editor"
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
                toggleRightPane={toggleRightPane}
              />
            )}
            {apiSpec.contents ? (
              <Toolbar>
                {
                  <Tooltip
                    message={
                      rulesetPath ? (
                        <Fragment>
                          <p>
                            Using ruleset from
                          </p>
                          <code
                            style={{
                              wordBreak: 'break-all',
                            }}
                          >{rulesetPath}</code>
                        </Fragment>
                      ) : (
                        <Fragment>
                          <p>Using default OAS ruleset.</p>
                          <p>
                            To use a custom ruleset add a{' '}
                            <code>.spectral.yaml</code> file to the root of your
                            git repository
                          </p>
                        </Fragment>
                      )
                    }
                  >
                    <RulesetLabel>
                      <i
                        className={
                          rulesetPath
                            ? 'fa fa-file-circle-check'
                            : 'fa fa-file-circle-xmark'
                        }
                      />{' '}
                      Ruleset
                    </RulesetLabel>
                  </Tooltip>
                }
                <button
                  disabled={lintMessages.filter(message => message.type === 'error').length > 0 || generateRequestCollectionFetcher.state !== 'idle'}
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
                  )} Generate Request Collection
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

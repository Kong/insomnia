import React, { FC, useState } from 'react';
import {
  Button,
  Tooltip,
  TooltipTrigger,
} from 'react-aria-components';
import { useParams, useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import { getContentTypeFromHeaders } from '../../../common/constants';
import * as models from '../../../models';
import { queryAllWorkspaceUrls } from '../../../models/helpers/query-all-workspace-urls';
import type { Settings } from '../../../models/settings';
import { deconstructQueryStringToParams, extractQueryStringFromUrl } from '../../../utils/url/querystring';
import { useRequestPatcher, useSettingsPatcher } from '../../hooks/use-request';
import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../hooks/use-vcs-version';
import { RequestLoaderData } from '../../routes/request';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';
import { PanelContainer, TabItem, Tabs } from '../base/tabs';
import { CodeEditor } from '../codemirror/code-editor';
import { AuthDropdown } from '../dropdowns/auth-dropdown';
import { ContentTypeDropdown } from '../dropdowns/content-type-dropdown';
import { AuthWrapper } from '../editors/auth/auth-wrapper';
import { BodyEditor } from '../editors/body/body-editor';
import {
  QueryEditor,
  QueryEditorContainer,
  QueryEditorPreview,
} from '../editors/query-editor';
import { RequestHeadersEditor } from '../editors/request-headers-editor';
import { RequestParametersEditor } from '../editors/request-parameters-editor';
import { ErrorBoundary } from '../error-boundary';
import { Icon } from '../icon';
import { MarkdownPreview } from '../markdown-preview';
import { RequestSettingsModal } from '../modals/request-settings-modal';
import { RenderedQueryString } from '../rendered-query-string';
import { RequestUrlBar } from '../request-url-bar';
import { Pane, PaneHeader } from './pane';
import { PlaceholderRequestPane } from './placeholder-request-pane';
const HeaderContainer = styled.div({
  display: 'flex',
  flexDirection: 'column',
  position: 'relative',
  height: '100%',
  overflowY: 'auto',
});

export const TabPanelFooter = styled.div({
  boxSizing: 'content-box',
  display: 'flex',
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

const TabPanelBody = styled.div({
  overflowY: 'auto',
  flex: '1 0',
});

interface Props {
  environmentId: string;
  settings: Settings;
  setLoading: (l: boolean) => void;
  onPaste: (text: string) => void;
}

export const RequestPane: FC<Props> = ({
  environmentId,
  settings,
  setLoading,
  onPaste,
}) => {
  const { activeRequest, activeRequestMeta } = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const { workspaceId, requestId } = useParams() as { organizationId: string; projectId: string; workspaceId: string; requestId: string };
  const patchSettings = useSettingsPatcher();
  const [isRequestSettingsModalOpen, setIsRequestSettingsModalOpen] =
    useState(false);
  const patchRequest = useRequestPatcher();

  useState(false);
  const handleImportQueryFromUrl = () => {
    let query;

    try {
      query = extractQueryStringFromUrl(activeRequest.url);
    } catch (error) {
      console.warn('Failed to parse url to import querystring');
      return;
    }

    // Remove the search string (?foo=bar&...) from the Url
    const url = activeRequest.url.replace(`?${query}`, '');
    const parameters = [
      ...activeRequest.parameters,
      ...deconstructQueryStringToParams(query),
    ];

    // Only update if url changed
    if (url !== activeRequest.url) {
      patchRequest(requestId, { url, parameters });
    }
  };
  const gitVersion = useGitVCSVersion();
  const activeRequestSyncVersion = useActiveRequestSyncVCSVersion();

  const { activeEnvironment } = useRouteLoaderData(
    ':workspaceId',
  ) as WorkspaceLoaderData;
  // Force re-render when we switch requests, the environment gets modified, or the (Git|Sync)VCS version changes
  const uniqueKey = `${activeEnvironment?.modified}::${requestId}::${gitVersion}::${activeRequestSyncVersion}::${activeRequestMeta?.activeResponseId}`;

  if (!activeRequest) {
    return <PlaceholderRequestPane />;
  }

  const numParameters = activeRequest.parameters.filter(
    p => !p.disabled,
  ).length;
  const numHeaders = activeRequest.headers.filter(h => !h.disabled).length;
  const urlHasQueryParameters = activeRequest.url.indexOf('?') >= 0;
  const contentType =
    getContentTypeFromHeaders(activeRequest.headers) ||
    activeRequest.body.mimeType;

  return (
    <Pane type="request">
      <PaneHeader>
        <ErrorBoundary errorClassName="font-error pad text-center">
          <RequestUrlBar
            key={requestId}
            uniquenessKey={uniqueKey}
            handleAutocompleteUrls={() => queryAllWorkspaceUrls(workspaceId, models.request.type, requestId)}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
            setLoading={setLoading}
            onPaste={onPaste}
          />
        </ErrorBoundary>
      </PaneHeader>
      <Tabs aria-label="Request pane tabs">
        <TabItem key="builder" title="Builder">
          <div className='p-5'>
            <TooltipTrigger>
              <Button
                aria-label='Send'
                className="pull-right btn btn--clicky ml-2"
                onPress={() => {
                  // stuff
                }}
              >Send</Button>
              <Tooltip
                placement="top"
                offset={8}
                className="border flex items-center gap-2 select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
              >
                Create a new bin and send a request to it
              </Tooltip>
            </TooltipTrigger>
            <TooltipTrigger>
              <Button
                aria-label='Save'
                className="pull-right btn btn--clicky ml-2"
                onPress={() => {
                  // stuff
                }}
              >Save</Button>
              <Tooltip
                placement="top"
                offset={8}
                className="border flex items-center gap-2 select-none text-sm min-w-max border-solid border-[--hl-sm] shadow-lg bg-[--color-bg] text-[--color-font] px-4 py-2 rounded-md overflow-y-auto max-h-[85vh] focus:outline-none"
              >
                Save this bin with a name and description
              </Tooltip>
            </TooltipTrigger>
            <Dropdown
              aria-label='Examples'
              triggerButton={
                <DropdownButton
                  variant='outlined'
                  removePaddings={false}
                  disableHoverBehavior={false}
                >
                  Example responses
                  <i className="fa fa-caret-down pad-left-sm" />
                </DropdownButton>
              }
            >
              <DropdownItem aria-label='JSON'>
                <ItemContent
                  icon="plus"
                  label="JSON"
                  onClick={() => { }}
                />
              </DropdownItem>
              <DropdownItem aria-label='Plaintext'>
                <ItemContent
                  icon="link"
                  label="Plaintext"
                  onClick={() => { }}
                />
              </DropdownItem>
            </Dropdown>
            <div className='form-control form-control--outlined'>
              <label>
                Status
                <input type="text" value="200" />
              </label>
            </div>
            <div className='form-control form-control--outlined'>
              <label>
                Headers
                <CodeEditor
                  id="example-headers-editor"
                  onChange={() => { }}
                  className='min-h-[50px]'
                  defaultValue={`Content-Type: application/json
User-Agent: insomnia/8.2.0`}
                />
              </label>
            </div>
            <div className='form-control form-control--outlined'>
              <label>
                Body
                <CodeEditor
                  id="example-body-editor"
                  className='min-h-[100px]'
                  onChange={() => { }}
                  defaultValue={`{
  "a": "b"
}`}
                />
              </label>
            </div>
          </div>
        </TabItem>
        <TabItem key="content-type" title={<ContentTypeDropdown />}>
          <BodyEditor
            key={uniqueKey}
            request={activeRequest}
            environmentId={environmentId}
          />
        </TabItem>
        <TabItem key="auth" title={<AuthDropdown />}>
          <ErrorBoundary
            key={uniqueKey}
            errorClassName="font-error pad text-center"
          >
            <AuthWrapper />
          </ErrorBoundary>
        </TabItem>
        <TabItem
          key="query"
          title={
            <>
              Query{' '}
              {numParameters > 0 && (
                <span className="bubble space-left">{numParameters}</span>
              )}
            </>
          }
        >
          <QueryEditorContainer>
            <QueryEditorPreview className="pad pad-bottom-sm">
              <label className="label--small no-pad-top">Url Preview</label>
              <code className="txt-sm block faint">
                <ErrorBoundary
                  key={uniqueKey}
                  errorClassName="tall wide vertically-align font-error pad text-center"
                >
                  <RenderedQueryString request={activeRequest} />
                </ErrorBoundary>
              </code>
            </QueryEditorPreview>
            <QueryEditor>
              <ErrorBoundary
                key={uniqueKey}
                errorClassName="tall wide vertically-align font-error pad text-center"
              >
                <RequestParametersEditor
                  key={contentType}
                  bulk={settings.useBulkParametersEditor}
                />
              </ErrorBoundary>
            </QueryEditor>
            <TabPanelFooter>
              <button
                className="btn btn--compact"
                title={
                  urlHasQueryParameters
                    ? 'Import querystring'
                    : 'No query params to import'
                }
                onClick={handleImportQueryFromUrl}
              >
                Import from URL
              </button>
              <button
                className="btn btn--compact"
                onClick={() =>
                  patchSettings({
                    useBulkParametersEditor: !settings.useBulkParametersEditor,
                  })
                }
              >
                {settings.useBulkParametersEditor
                  ? 'Regular Edit'
                  : 'Bulk Edit'}
              </button>
            </TabPanelFooter>
          </QueryEditorContainer>
        </TabItem>
        <TabItem
          key="headers"
          title={
            <>
              Headers{' '}
              {numHeaders > 0 && (
                <span className="bubble space-left">{numHeaders}</span>
              )}
            </>
          }
        >
          <HeaderContainer>
            <ErrorBoundary
              key={uniqueKey}
              errorClassName="font-error pad text-center"
            >
              <TabPanelBody>
                <RequestHeadersEditor bulk={settings.useBulkHeaderEditor} />
              </TabPanelBody>
            </ErrorBoundary>

            <TabPanelFooter>
              <button
                className="btn btn--compact"
                onClick={() =>
                  patchSettings({
                    useBulkHeaderEditor: !settings.useBulkHeaderEditor,
                  })
                }
              >
                {settings.useBulkHeaderEditor ? 'Regular Edit' : 'Bulk Edit'}
              </button>
            </TabPanelFooter>
          </HeaderContainer>
        </TabItem>
        <TabItem
          key="docs"
          title={
            <>
              Docs
              {activeRequest.description && (
                <span className="bubble space-left">
                  <i className="fa fa--skinny fa-check txt-xxs" />
                </span>
              )}
            </>
          }
        >
          <PanelContainer className="tall">
            {activeRequest.description ? (
              <div>
                <div className="pull-right pad bg-default">
                  <button
                    className="btn btn--clicky"
                    onClick={() => setIsRequestSettingsModalOpen(true)}
                  >
                    Edit
                  </button>
                </div>
                <div className="pad">
                  <ErrorBoundary errorClassName="font-error pad text-center">
                    <MarkdownPreview
                      heading={activeRequest.name}
                      markdown={activeRequest.description}
                    />
                  </ErrorBoundary>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden editor vertically-center text-center">
                <p className="pad text-sm text-center">
                  <span className="super-faint">
                    <i
                      className="fa fa-file-text-o"
                      style={{
                        fontSize: '8rem',
                        opacity: 0.3,
                      }}
                    />
                  </span>
                  <br />
                  <br />
                  <button
                    className="btn btn--clicky faint"
                    onClick={() => setIsRequestSettingsModalOpen(true)}
                  >
                    Add Description
                  </button>
                </p>
              </div>
            )}
          </PanelContainer>
        </TabItem>
      </Tabs>
      {isRequestSettingsModalOpen && (
        <RequestSettingsModal
          request={activeRequest}
          onHide={() => setIsRequestSettingsModalOpen(false)}
        />
      )}
    </Pane>
  );
};

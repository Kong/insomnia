import React, { FC, Fragment, useState } from 'react';
import { Button, Heading, ToggleButton } from 'react-aria-components';
import { useParams, useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import { getContentTypeFromHeaders } from '../../../common/constants';
import * as models from '../../../models';
import { queryAllWorkspaceUrls } from '../../../models/helpers/query-all-workspace-urls';
import { RequestParameter } from '../../../models/request';
import type { Settings } from '../../../models/settings';
import { deconstructQueryStringToParams, extractQueryStringFromUrl } from '../../../utils/url/querystring';
import { useRequestPatcher, useSettingsPatcher } from '../../hooks/use-request';
import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../hooks/use-vcs-version';
import { RequestLoaderData } from '../../routes/request';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { PanelContainer, TabItem, Tabs } from '../base/tabs';
import { OneLineEditor } from '../codemirror/one-line-editor';
import { AuthDropdown } from '../dropdowns/auth-dropdown';
import { ContentTypeDropdown } from '../dropdowns/content-type-dropdown';
import { AuthWrapper } from '../editors/auth/auth-wrapper';
import { BodyEditor } from '../editors/body/body-editor';
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

  // Path parameters are path segments that start with a colon (:)
  const urlPathParameters = activeRequest.url.match(/:[^/?#]+/g)?.map(String) || [];
  const savedPathParameters = activeRequest.pathParameters?.filter(p => urlPathParameters.includes(p.name)) || [];
  const finalPathParameters = [...savedPathParameters, ...urlPathParameters?.filter(p => !savedPathParameters.map(p => p.name).includes(p)).map(p => ({ name: p, value: '' }))];

  const onPathParameterChange = (pathParameters: RequestParameter[]) => {
    patchRequest(requestId, { pathParameters });
  };
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
        <TabItem
          key="query"
          title={'Parameters'}
        >
          <div className="grid h-full auto-rows-auto [grid-template-columns:100%] divide-y divide-solid divide-[--hl-md]">
            <div className="max-h-[14rem] grid grid-rows-auto auto-rows-min p-4">
              <label className="label--small no-pad-top">Url Preview</label>
              <code className="txt-sm block faint overflow-auto min-h-[2em]">
                <ErrorBoundary
                  key={uniqueKey}
                  errorClassName="tall wide vertically-align font-error pad text-center"
                >
                  <RenderedQueryString request={activeRequest} />
                </ErrorBoundary>
              </code>
            </div>
            <div className="min-h-[2rem] max-h-full flex flex-col overflow-y-auto [&_.key-value-editor]:p-0">
              <div className='flex items-center w-full p-4 justify-between'>
                <Heading className='text-xs font-bold uppercase text-[--hl]'>Query parameters</Heading>
                <div className='flex items-center gap-2'>
                  <Button
                    isDisabled={!urlHasQueryParameters}
                    onPress={handleImportQueryFromUrl}
                    className="w-[14ch] flex flex-shrink-0 gap-2 items-center justify-start px-2 py-1 h-full aria-pressed:bg-[--hl-sm] aria-selected:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  >
                    Import from URL
                  </Button>
                  <ToggleButton
                    onChange={isSelected => {
                      patchSettings({
                        useBulkParametersEditor: isSelected,
                      });
                    }}
                    isSelected={settings.useBulkParametersEditor}
                    className="w-[14ch] flex flex-shrink-0 gap-2 items-center justify-start px-2 py-1 h-full aria-pressed:bg-[--hl-sm] aria-selected:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  >
                    {({ isSelected }) => (
                      <Fragment>
                        <Icon icon={isSelected ? 'toggle-on' : 'toggle-off'} className={`${isSelected ? 'text-[--color-success]' : ''}`} />
                        <span>{
                          isSelected ? 'Regular Edit' : 'Bulk Edit'
                        }</span>
                      </Fragment>
                    )}
                  </ToggleButton>
                </div>
              </div>
              <ErrorBoundary
                key={uniqueKey}
                errorClassName="tall wide vertically-align font-error pad text-center"
              >
                <RequestParametersEditor
                  key={contentType}
                  bulk={settings.useBulkParametersEditor}
                />
              </ErrorBoundary>
            </div>
            <div className='flex-1 flex flex-col gap-2 p-4 border-t border-solid border-[--hl-md] overflow-y-auto'>
              <Heading className='text-xs font-bold uppercase text-[--hl]'>Path parameters</Heading>
              <div className='grid grid-cols-2 flex-shrink-0 w-full divide-x divide-y divide-solid divide-[--hl-sm] rounded-sm border border-solid border-[--hl-sm] overflow-hidden'>
                {finalPathParameters.map(pathParameter => (
                  <Fragment key={pathParameter.name}>
                    <span className='p-2 bg-[--hl-xs] truncate flex text-sm items-center justify-end'>
                      {pathParameter.name.slice(1)}
                    </span>
                    <div className='px-2 flex items-center h-full'>
                      <OneLineEditor
                        id={'key-value-editor__name' + pathParameter.name}
                        placeholder={'Parameter value'}
                        defaultValue={pathParameter.value || ''}
                        onChange={name => {
                          onPathParameterChange(finalPathParameters.map(p => p.name === pathParameter.name ? { ...p, value: name } : p));
                        }}
                      />
                    </div>
                  </Fragment>
                ))}
              </div>
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

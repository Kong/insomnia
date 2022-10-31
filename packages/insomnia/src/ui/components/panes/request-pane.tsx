import { invariant } from '@remix-run/router';
import classnames from 'classnames';
import { deconstructQueryStringToParams, extractQueryStringFromUrl } from 'insomnia-url';
import React, { FC, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import styled from 'styled-components';

import { getContentTypeFromHeaders } from '../../../common/constants';
import { database } from '../../../common/database';
import * as models from '../../../models';
import { queryAllWorkspaceUrls } from '../../../models/helpers/query-all-workspace-urls';
import type { Request } from '../../../models/request';
import type { Settings } from '../../../models/settings';
import type { Workspace } from '../../../models/workspace';
import { useActiveRequestSyncVCSVersion, useGitVCSVersion } from '../../hooks/use-vcs-version';
import { selectActiveEnvironment, selectActiveRequestMeta } from '../../redux/selectors';
import { AuthDropdown } from '../dropdowns/auth-dropdown';
import { ContentTypeDropdown } from '../dropdowns/content-type-dropdown';
import { AuthWrapper } from '../editors/auth/auth-wrapper';
import { BodyEditor } from '../editors/body/body-editor';
import { RequestHeadersEditor } from '../editors/request-headers-editor';
import { RequestParametersEditor } from '../editors/request-parameters-editor';
import { ErrorBoundary } from '../error-boundary';
import { MarkdownPreview } from '../markdown-preview';
import { showModal } from '../modals';
import { RequestSettingsModal } from '../modals/request-settings-modal';
import { RenderedQueryString } from '../rendered-query-string';
import { RequestUrlBar, RequestUrlBarHandle } from '../request-url-bar';
import { Pane, paneBodyClasses, PaneHeader } from './pane';
import { PlaceholderRequestPane } from './placeholder-request-pane';

const HeaderTabPanel = styled(TabPanel)({
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
  request?: Request | null;
  settings: Settings;
  workspace: Workspace;
}

export const RequestPane: FC<Props> = ({
  environmentId,
  request,
  settings,
  workspace,
}) => {
  console.log('rerender', request?.body.mimeType);

  const handleImportQueryFromUrl = () => {
    invariant(request, 'Tried to import query when no request active');
    let query;

    try {
      query = extractQueryStringFromUrl(request.url);
    } catch (error) {
      console.warn('Failed to parse url to import querystring');
      return;
    }

    // Remove the search string (?foo=bar&...) from the Url
    const url = request.url.replace(`?${query}`, '');
    const parameters = [...request.parameters, ...deconstructQueryStringToParams(query)];

    // Only update if url changed
    if (url !== request.url) {
      database.update({
        ...request,
        modified: Date.now(),
        url,
        parameters,
        // Hack to force the ui to refresh. More info on use-vcs-version
      }, true);
    }
  };
  const gitVersion = useGitVCSVersion();
  const activeRequestSyncVersion = useActiveRequestSyncVCSVersion();
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const activeRequestMeta = useSelector(selectActiveRequestMeta);
  // Force re-render when we switch requests, the environment gets modified, or the (Git|Sync)VCS version changes
  const uniqueKey = `${activeEnvironment?.modified}::${request?._id}::${gitVersion}::${activeRequestSyncVersion}::${activeRequestMeta?.activeResponseId}`;

  const requestUrlBarRef = useRef<RequestUrlBarHandle>(null);
  useEffect(() => {
    requestUrlBarRef.current?.focusInput();
  }, [
    request?._id, // happens when the user switches requests
    settings.hasPromptedAnalytics, // happens when the user dismisses the analytics modal
    uniqueKey,
  ]);

  if (!request) {
    return (
      <PlaceholderRequestPane />
    );
  }

  const numParameters = request.parameters.filter(p => !p.disabled).length;
  const numHeaders = request.headers.filter(h => !h.disabled).length;
  const urlHasQueryParameters = request.url.indexOf('?') >= 0;
  const contentType = getContentTypeFromHeaders(request.headers) || request.body.mimeType;
  return (
    <Pane type="request">
      <PaneHeader>
        <ErrorBoundary errorClassName="font-error pad text-center">
          <RequestUrlBar
            key={request._id}
            ref={requestUrlBarRef}
            uniquenessKey={uniqueKey}
            handleAutocompleteUrls={() => queryAllWorkspaceUrls(workspace, models.request.type, request?._id)}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
          />
        </ErrorBoundary>
      </PaneHeader>
      <Tabs className={classnames(paneBodyClasses, 'react-tabs')}>
        <TabList>
          <Tab tabIndex="-1">
            <ContentTypeDropdown />
          </Tab>
          <Tab tabIndex="-1">
            <AuthDropdown />
          </Tab>
          <Tab tabIndex="-1">
            <button>
              Query
              {numParameters > 0 && <span className="bubble space-left">{numParameters}</span>}
            </button>
          </Tab>
          <Tab tabIndex="-1">
            <button>
              Headers
              {numHeaders > 0 && <span className="bubble space-left">{numHeaders}</span>}
            </button>
          </Tab>
          <Tab tabIndex="-1">
            <button>
              Docs
              {request.description && (
                <span className="bubble space-left">
                  <i className="fa fa--skinny fa-check txt-xxs" />
                </span>
              )}
            </button>
          </Tab>
        </TabList>
        <TabPanel key={uniqueKey} className="react-tabs__tab-panel editor-wrapper">
          <BodyEditor
            key={uniqueKey}
            request={request}
            workspace={workspace}
            environmentId={environmentId}
            settings={settings}
          />
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel scrollable-container">
          <div className="scrollable">
            <ErrorBoundary key={uniqueKey} errorClassName="font-error pad text-center">
              <AuthWrapper />
            </ErrorBoundary>
          </div>
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel query-editor">
          <div className="pad pad-bottom-sm query-editor__preview">
            <label className="label--small no-pad-top">Url Preview</label>
            <code className="txt-sm block faint">
              <ErrorBoundary
                key={uniqueKey}
                errorClassName="tall wide vertically-align font-error pad text-center"
              >
                <RenderedQueryString request={request} />
              </ErrorBoundary>
            </code>
          </div>
          <div className="query-editor__editor">
            <ErrorBoundary
              key={uniqueKey}
              errorClassName="tall wide vertically-align font-error pad text-center"
            >
              <RequestParametersEditor
                key={contentType}
                requestId={request._id}
                bulk={settings.useBulkParametersEditor}
              />
            </ErrorBoundary>
          </div>
          <TabPanelFooter>
            <button
              className="btn btn--compact"
              title={urlHasQueryParameters ? 'Import querystring' : 'No query params to import'}
              onClick={handleImportQueryFromUrl}
            >
              Import from URL
            </button>
            <button
              className="btn btn--compact"
              onClick={() => models.settings.update(settings, { useBulkParametersEditor: !settings.useBulkParametersEditor })}
            >
              {settings.useBulkParametersEditor ? 'Regular Edit' : 'Bulk Edit'}
            </button>
          </TabPanelFooter>
        </TabPanel>
        <HeaderTabPanel className="react-tabs__tab-panel">
          <ErrorBoundary key={uniqueKey} errorClassName="font-error pad text-center">
            <TabPanelBody>
              <RequestHeadersEditor
                request={request}
                bulk={settings.useBulkHeaderEditor}
              />
            </TabPanelBody>
          </ErrorBoundary>

          <TabPanelFooter>
            <button
              className="btn btn--compact"
              onClick={() => models.settings.update(settings, { useBulkHeaderEditor: !settings.useBulkHeaderEditor })}
            >
              {settings.useBulkHeaderEditor ? 'Regular Edit' : 'Bulk Edit'}
            </button>
          </TabPanelFooter>
        </HeaderTabPanel>
        <TabPanel key={`docs::${uniqueKey}`} className="react-tabs__tab-panel tall scrollable">
          {request.description ? (
            <div>
              <div className="pull-right pad bg-default">
                <button className="btn btn--clicky" onClick={() => showModal(RequestSettingsModal, { request, forceEditMode: false })}>
                  Edit
                </button>
              </div>
              <div className="pad">
                <ErrorBoundary errorClassName="font-error pad text-center">
                  <MarkdownPreview
                    heading={request.name}
                    markdown={request.description}
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
                  onClick={() => showModal(RequestSettingsModal, { request, forceEditMode: true })}
                >
                  Add Description
                </button>
              </p>
            </div>
          )}
        </TabPanel>
      </Tabs>
    </Pane>
  );
};

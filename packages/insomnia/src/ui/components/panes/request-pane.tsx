import classnames from 'classnames';
import { deconstructQueryStringToParams, extractQueryStringFromUrl } from 'insomnia-url';
import React, { FC, useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import styled from 'styled-components';

import { getContentTypeFromHeaders } from '../../../common/constants';
import { database } from '../../../common/database';
import * as models from '../../../models';
import { queryAllWorkspaceUrls } from '../../../models/helpers/query-all-workspace-urls';
import { update } from '../../../models/helpers/request-operations';
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

  const updateRequestUrl = (request: Request, url: string) => {
    if (request.url === url) {
      return Promise.resolve(request);
    }
    return update(request, { url });
  };

  const handleEditDescription = useCallback((forceEditMode: boolean) => {
    showModal(RequestSettingsModal, { request, forceEditMode });
  }, [request]);

  const handleEditDescriptionAdd = useCallback(() => {
    handleEditDescription(true);
  }, [handleEditDescription]);

  const autocompleteUrls = useCallback(() => {
    return queryAllWorkspaceUrls(workspace, models.request.type, request?._id);
  }, [workspace, request]);

  const handleUpdateSettingsUseBulkHeaderEditor = useCallback(() => {
    models.settings.update(settings, { useBulkHeaderEditor:!settings.useBulkHeaderEditor });
  }, [settings]);

  const handleUpdateSettingsUseBulkParametersEditor = useCallback(() => {
    models.settings.update(settings, { useBulkParametersEditor:!settings.useBulkParametersEditor });
  }, [settings]);

  const handleImportQueryFromUrl = useCallback(() => {
    if (!request) {
      console.warn('Tried to import query when no request active');
      return;
    }

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
  }, [request]);
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

  async function updateRequestMimeType(mimeType: string | null): Promise<Request | null> {
    if (!request) {
      console.warn('Tried to update request mime-type when no active request');
      return null;
    }
    const requestMeta = await models.requestMeta.getOrCreateByParentId(request._id,);
    // Switched to No body
    const savedRequestBody = typeof mimeType !== 'string' ? request.body : {};
    // Clear saved value in requestMeta
    await models.requestMeta.update(requestMeta, { savedRequestBody });
    // @ts-expect-error -- TSCONVERSION mimeType can be null when no body is selected but the updateMimeType logic needs to be reexamined
    return models.request.updateMimeType(request, mimeType, false, requestMeta.savedRequestBody);
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
            onUrlChange={updateRequestUrl}
            handleAutocompleteUrls={autocompleteUrls}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
            request={request}
          />
        </ErrorBoundary>
      </PaneHeader>
      <Tabs className={classnames(paneBodyClasses, 'react-tabs')}>
        <TabList>
          <Tab tabIndex="-1">
            <ContentTypeDropdown onChange={updateRequestMimeType} />
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
                request={request}
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
              onClick={handleUpdateSettingsUseBulkParametersEditor}
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
              onClick={handleUpdateSettingsUseBulkHeaderEditor}
            >
              {settings.useBulkHeaderEditor ? 'Regular Edit' : 'Bulk Edit'}
            </button>
          </TabPanelFooter>
        </HeaderTabPanel>
        <TabPanel key={`docs::${uniqueKey}`} className="react-tabs__tab-panel tall scrollable">
          {request.description ? (
            <div>
              <div className="pull-right pad bg-default">
                {/* @ts-expect-error -- TSCONVERSION the click handler expects a boolean prop... */}
                <button className="btn btn--clicky" onClick={handleEditDescription}>
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
                  onClick={handleEditDescriptionAdd}
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

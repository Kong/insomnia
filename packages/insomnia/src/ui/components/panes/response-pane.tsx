import fs from 'fs';
import { extension as mimeExtension } from 'mime-types';
import React, { FC, useCallback } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { PREVIEW_MODE_SOURCE } from '../../../common/constants';
import { getSetCookieHeaders } from '../../../common/misc';
import * as models from '../../../models';
import { cancelRequestById } from '../../../network/cancellation';
import { jsonPrettify } from '../../../utils/prettify/json';
import { useRequestMetaPatcher } from '../../hooks/use-request';
import { RequestLoaderData } from '../../routes/request';
import { useRootLoaderData } from '../../routes/root';
import { PanelContainer, TabItem, Tabs } from '../base/tabs';
import { PreviewModeDropdown } from '../dropdowns/preview-mode-dropdown';
import { ResponseHistoryDropdown } from '../dropdowns/response-history-dropdown';
import { ErrorBoundary } from '../error-boundary';
import { showError } from '../modals';
import { ResponseTimer } from '../response-timer';
import { SizeTag } from '../tags/size-tag';
import { StatusTag } from '../tags/status-tag';
import { TimeTag } from '../tags/time-tag';
import { ResponseCookiesViewer } from '../viewers/response-cookies-viewer';
import { ResponseHeadersViewer } from '../viewers/response-headers-viewer';
import { ResponseTimelineViewer } from '../viewers/response-timeline-viewer';
import { ResponseViewer } from '../viewers/response-viewer';
import { BlankPane } from './blank-pane';
import { Pane, PaneHeader } from './pane';
import { PlaceholderResponsePane } from './placeholder-response-pane';

interface Props {
  runningRequests: Record<string, boolean>;
}
export const ResponsePane: FC<Props> = ({
  runningRequests,
}) => {
  const { activeRequest, activeRequestMeta, activeResponse } = useRouteLoaderData('request/:requestId') as RequestLoaderData;
  const filterHistory = activeRequestMeta.responseFilterHistory || [];
  const filter = activeRequestMeta.responseFilter || '';
  const patchRequestMeta = useRequestMetaPatcher();
  const {
    settings,
  } = useRootLoaderData();
  const previewMode = activeRequestMeta.previewMode || PREVIEW_MODE_SOURCE;
  const handleSetFilter = async (responseFilter: string) => {
    if (!activeResponse) {
      return;
    }
    const requestId = activeResponse.parentId;
    await patchRequestMeta(requestId, { responseFilter });
    const meta = await models.requestMeta.getByParentId(requestId);
    if (!meta) {
      return;
    }
    const responseFilterHistory = meta.responseFilterHistory.slice(0, 10);
    // Already in history or empty?
    if (!responseFilter || responseFilterHistory.includes(responseFilter)) {
      return;
    }
    responseFilterHistory.unshift(responseFilter);
    patchRequestMeta(requestId, { responseFilterHistory });
  };
  const handleGetResponseBody = useCallback(() => {
    if (!activeResponse) {
      return null;
    }
    return models.response.getBodyBuffer(activeResponse);
  }, [activeResponse]);
  const handleCopyResponseToClipboard = useCallback(async () => {
    const bodyBuffer = handleGetResponseBody();
    if (bodyBuffer) {
      window.clipboard.writeText(bodyBuffer.toString('utf8'));
    }
  }, [handleGetResponseBody]);
  const handleDownloadResponseBody = useCallback(async (prettify: boolean) => {
    if (!activeResponse || !activeRequest) {
      console.warn('Nothing to download');
      return;
    }

    const { contentType } = activeResponse;
    const extension = mimeExtension(contentType) || 'unknown';
    const { canceled, filePath: outputPath } = await window.dialog.showSaveDialog({
      title: 'Save Response Body',
      buttonLabel: 'Save',
      defaultPath: `${activeRequest.name.replace(/ +/g, '_')}-${Date.now()}.${extension}`,
    });

    if (canceled) {
      return;
    }

    const readStream = models.response.getBodyStream(activeResponse);
    const dataBuffers: any[] = [];

    if (readStream && outputPath && typeof readStream !== 'string') {
      readStream.on('data', data => {
        dataBuffers.push(data);
      });
      readStream.on('end', () => {
        const to = fs.createWriteStream(outputPath);
        const finalBuffer = Buffer.concat(dataBuffers);
        to.on('error', err => {
          showError({
            title: 'Save Failed',
            message: 'Failed to save response body',
            error: err,
          });
        });

        if (prettify && contentType.includes('json')) {
          to.write(jsonPrettify(finalBuffer.toString('utf8')));
        } else {
          to.write(finalBuffer);
        }

        to.end();
      });
    }
  }, [activeRequest, activeResponse]);

  if (!activeRequest) {
    return <BlankPane type="response" />;
  }

  // If there is no previous response, show placeholder for loading indicator
  if (!activeResponse) {
    return (
      <PlaceholderResponsePane>
        {runningRequests[activeRequest._id] && <ResponseTimer
          handleCancel={() => cancelRequestById(activeRequest._id)}
        />}
      </PlaceholderResponsePane>
    );
  }
  const timeline = models.response.getTimeline(activeResponse);
  const cookieHeaders = getSetCookieHeaders(activeResponse.headers);
  return (
    <Pane type="response">
      {!activeResponse ? null : (
        <PaneHeader className="row-spaced">
          <div aria-atomic="true" aria-live="polite" className="no-wrap scrollable scrollable--no-bars pad-left">
            <StatusTag statusCode={activeResponse.statusCode} statusMessage={activeResponse.statusMessage} />
            <TimeTag milliseconds={activeResponse.elapsedTime} />
            <SizeTag bytesRead={activeResponse.bytesRead} bytesContent={activeResponse.bytesContent} />
          </div>
          <ResponseHistoryDropdown
            activeResponse={activeResponse}
          />
        </PaneHeader>
      )}
      <Tabs aria-label="Response pane tabs">
        <TabItem
          key="preview"
          title={
            <PreviewModeDropdown
              download={handleDownloadResponseBody}
              copyToClipboard={handleCopyResponseToClipboard}
            />
          }
        >
          <ResponseViewer
            key={activeResponse._id}
            bytes={Math.max(activeResponse.bytesContent, activeResponse.bytesRead)}
            contentType={activeResponse.contentType || ''}
            disableHtmlPreviewJs={settings.disableHtmlPreviewJs}
            disablePreviewLinks={settings.disableResponsePreviewLinks}
            download={handleDownloadResponseBody}
            editorFontSize={settings.editorFontSize}
            error={activeResponse.error}
            filter={filter}
            filterHistory={filterHistory}
            getBody={handleGetResponseBody}
            previewMode={activeResponse.error ? PREVIEW_MODE_SOURCE : previewMode}
            responseId={activeResponse._id}
            updateFilter={activeResponse.error ? undefined : handleSetFilter}
            url={activeResponse.url}
          />
        </TabItem>
        <TabItem
          key="headers"
          title={
            <>
              Headers
              {activeResponse.headers.length > 0 && (
                <span className="bubble">{activeResponse.headers.length}</span>
              )}
            </>
          }
        >
          <PanelContainer className="pad">
            <ErrorBoundary key={activeResponse._id} errorClassName="font-error pad text-center">
              <ResponseHeadersViewer headers={activeResponse.headers} />
            </ErrorBoundary>
          </PanelContainer>
        </TabItem>
        <TabItem
          key="cookies"
          title={
            <>
              Cookies
              {cookieHeaders.length ? (
                <span className="bubble">{cookieHeaders.length}</span>
              ) : null}
            </>
          }
        >
          <PanelContainer className="pad">
            <ErrorBoundary key={activeResponse._id} errorClassName="font-error pad text-center">
              <ResponseCookiesViewer
                cookiesSent={activeResponse.settingSendCookies}
                cookiesStored={activeResponse.settingStoreCookies}
                headers={cookieHeaders}
              />
            </ErrorBoundary>
          </PanelContainer>
        </TabItem>
        <TabItem key="timeline" title="Timeline">
          <ErrorBoundary key={activeResponse._id} errorClassName="font-error pad text-center">
            <ResponseTimelineViewer
              key={activeResponse._id}
              timeline={timeline}
            />
          </ErrorBoundary>
        </TabItem>
      </Tabs>
      <ErrorBoundary errorClassName="font-error pad text-center">
        {runningRequests[activeRequest._id] && <ResponseTimer
          handleCancel={() => cancelRequestById(activeRequest._id)}
        />}
      </ErrorBoundary>
    </Pane>
  );
};

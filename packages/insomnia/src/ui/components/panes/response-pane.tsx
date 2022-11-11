import { clipboard } from 'electron';
import fs from 'fs';
import { extension as mimeExtension } from 'mime-types';
import React, { FC, useCallback } from 'react';
import { useSelector } from 'react-redux';

import { PREVIEW_MODE_SOURCE } from '../../../common/constants';
import { getSetCookieHeaders } from '../../../common/misc';
import * as models from '../../../models';
import type { Request } from '../../../models/request';
import type { Response } from '../../../models/response';
import { cancelRequestById } from '../../../network/network';
import { jsonPrettify } from '../../../utils/prettify/json';
import { updateRequestMetaByParentId } from '../../hooks/create-request';
import { selectActiveResponse, selectLoadStartTime, selectResponseFilter, selectResponseFilterHistory, selectResponsePreviewMode, selectSettings } from '../../redux/selectors';
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
  request?: Request | null;
}
export const ResponsePane: FC<Props> = ({
  request,
}) => {
  const response = useSelector(selectActiveResponse) as Response | null;
  const filterHistory = useSelector(selectResponseFilterHistory);
  const filter = useSelector(selectResponseFilter);
  const settings = useSelector(selectSettings);
  const loadStartTime = useSelector(selectLoadStartTime);
  const previewMode = useSelector(selectResponsePreviewMode);
  const handleSetFilter = async (responseFilter: string) => {
    if (!response) {
      return;
    }
    const requestId = response.parentId;
    await updateRequestMetaByParentId(requestId, { responseFilter });
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
    updateRequestMetaByParentId(requestId, { responseFilterHistory });
  };
  const handleGetResponseBody = useCallback(() => {
    if (!response) {
      return null;
    }
    return models.response.getBodyBuffer(response);
  }, [response]);
  const handleCopyResponseToClipboard = useCallback(async () => {
    const bodyBuffer = handleGetResponseBody();
    if (bodyBuffer) {
      clipboard.writeText(bodyBuffer.toString('utf8'));
    }
  }, [handleGetResponseBody]);
  const handleDownloadResponseBody = useCallback(async (prettify: boolean) => {
    if (!response || !request) {
      console.warn('Nothing to download');
      return;
    }

    const { contentType } = response;
    const extension = mimeExtension(contentType) || 'unknown';
    const { canceled, filePath: outputPath } = await window.dialog.showSaveDialog({
      title: 'Save Response Body',
      buttonLabel: 'Save',
      defaultPath: `${request.name.replace(/ +/g, '_')}-${Date.now()}.${extension}`,
    });

    if (canceled) {
      return;
    }

    const readStream = models.response.getBodyStream(response);
    const dataBuffers: any[] = [];

    if (readStream && outputPath) {
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
  }, [request, response]);

  if (!request) {
    return <BlankPane type="response" />;
  }

  if (!response) {
    return (
      <PlaceholderResponsePane>
        <ResponseTimer
          handleCancel={() => cancelRequestById(request._id)}
          loadStartTime={loadStartTime}
        />
      </PlaceholderResponsePane>
    );
  }
  const timeline = models.response.getTimeline(response);
  const cookieHeaders = getSetCookieHeaders(response.headers);
  return (
    <Pane type="response">
      {!response ? null : (
        <PaneHeader className="row-spaced">
          <div aria-atomic="true" aria-live="polite" className="no-wrap scrollable scrollable--no-bars pad-left">
            <StatusTag statusCode={response.statusCode} statusMessage={response.statusMessage} />
            <TimeTag milliseconds={response.elapsedTime} />
            <SizeTag bytesRead={response.bytesRead} bytesContent={response.bytesContent} />
          </div>
          <ResponseHistoryDropdown
            activeResponse={response}
            requestId={request._id}
            className="tall pane__header__right"
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
            key={response._id}
            bytes={Math.max(response.bytesContent, response.bytesRead)}
            contentType={response.contentType || ''}
            disableHtmlPreviewJs={settings.disableHtmlPreviewJs}
            disablePreviewLinks={settings.disableResponsePreviewLinks}
            download={handleDownloadResponseBody}
            editorFontSize={settings.editorFontSize}
            error={response.error}
            filter={filter}
            filterHistory={filterHistory}
            getBody={handleGetResponseBody}
            previewMode={response.error ? PREVIEW_MODE_SOURCE : previewMode}
            responseId={response._id}
            updateFilter={response.error ? undefined : handleSetFilter}
            url={response.url}
          />
        </TabItem>
        <TabItem
          key="headers"
          title={
            <>
              Headers
              {response.headers.length > 0 && (
                <span className="bubble">{response.headers.length}</span>
              )}
            </>
          }
        >
          <PanelContainer className="pad">
            <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
              <ResponseHeadersViewer headers={response.headers} />
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
            <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
              <ResponseCookiesViewer
                cookiesSent={response.settingSendCookies}
                cookiesStored={response.settingStoreCookies}
                headers={cookieHeaders}
              />
            </ErrorBoundary>
          </PanelContainer>
        </TabItem>
        <TabItem key="timeline" title="Timeline">
          <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
            <ResponseTimelineViewer
              key={response._id}
              timeline={timeline}
            />
          </ErrorBoundary>
        </TabItem>
      </Tabs>
      <ErrorBoundary errorClassName="font-error pad text-center">
        <ResponseTimer
          handleCancel={() => cancelRequestById(request._id)}
          loadStartTime={loadStartTime}
        />
      </ErrorBoundary>
    </Pane>
  );
};

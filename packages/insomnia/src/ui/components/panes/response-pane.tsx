import classnames from 'classnames';
import { clipboard } from 'electron';
import fs from 'fs';
import { json as jsonPrettify } from 'insomnia-prettify';
import { extension as mimeExtension } from 'mime-types';
import React, { FC, useRef } from 'react';
import { useSelector } from 'react-redux';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';

import { PREVIEW_MODE_SOURCE } from '../../../common/constants';
import { getSetCookieHeaders } from '../../../common/misc';
import * as models from '../../../models';
import type { Request } from '../../../models/request';
import { cancelRequestById } from '../../../network/network';
import { selectActiveResponse, selectLoadStartTime, selectResponseFilter, selectResponseFilterHistory, selectResponsePreviewMode, selectSettings } from '../../redux/selectors';
import { Button } from '../base/button';
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
import { Pane, paneBodyClasses, PaneHeader } from './pane';
import { PlaceholderResponsePane } from './placeholder-response-pane';

interface Props {
  handleSetActiveResponse: Function;
  handleSetFilter: (filter: string) => void;
  handleShowRequestSettings: Function;
  request?: Request | null;
}
export const ResponsePane: FC<Props> = ({
  handleSetActiveResponse,
  handleSetFilter,
  handleShowRequestSettings,
  request,
}) => {
  const response = useSelector(selectActiveResponse);
  const filterHistory = useSelector(selectResponseFilterHistory);
  const filter = useSelector(selectResponseFilter);
  const settings = useSelector(selectSettings);
  const loadStartTime = useSelector(selectLoadStartTime);
  const previewMode = useSelector(selectResponsePreviewMode);

  const responseViewerRef = useRef<ResponseViewer>(null);
  const handleGetResponseBody = (): Buffer | null => {
    if (!response) {
      return null;
    }
    return models.response.getBodyBuffer(response);
  };
  const handleCopyResponseToClipboard = async () => {
    const bodyBuffer = handleGetResponseBody();
    if (bodyBuffer) {
      clipboard.writeText(bodyBuffer.toString('utf8'));
    }
  };

  const handleDownloadResponseBody = async (prettify: boolean) => {
    if (!response || !request) {
      // Should never happen
      console.warn('No response to download');
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

    if (readStream) {
      readStream.on('data', data => {
        dataBuffers.push(data);
      });
      readStream.on('end', () => {
        // @ts-expect-error -- TSCONVERSION
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
  };

  const handleDownloadFullResponseBody = async () => {
    if (!response || !request) {
      // Should never happen
      console.warn('No response to download');
      return;
    }

    const timeline = models.response.getTimeline(response);
    const headers = timeline
      .filter(v => v.name === 'HeaderIn')
      .map(v => v.value)
      .join('');

    const { canceled, filePath } = await window.dialog.showSaveDialog({
      title: 'Save Full Response',
      buttonLabel: 'Save',
      defaultPath: `${request.name.replace(/ +/g, '_')}-${Date.now()}.txt`,
    });

    if (canceled) {
      return;
    }

    const readStream = models.response.getBodyStream(response);

    if (readStream) {
      // @ts-expect-error -- TSCONVERSION
      const to = fs.createWriteStream(filePath);
      to.write(headers);
      readStream.pipe(to);
      to.on('error', err => {
        console.warn('Failed to save full response', err);
      });
    }
  };

  const handleTabSelect = (index: number, lastIndex: number) => {
    if (responseViewerRef.current != null && index === 0 && index !== lastIndex) {
      // Fix for CodeMirror editor not updating its content.
      // Refresh must be called when the editor is visible,
      // so use nextTick to give time for it to be visible.
      process.nextTick(() => {
        responseViewerRef.current?.refresh();
      });
    }
  };

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

  const cookieHeaders = getSetCookieHeaders(response.headers);
  return (
    <Pane type="response">
      {!response ? null : (
        <PaneHeader className="row-spaced">
          <div className="no-wrap scrollable scrollable--no-bars pad-left">
            <StatusTag statusCode={response.statusCode} statusMessage={response.statusMessage} />
            <TimeTag milliseconds={response.elapsedTime} />
            <SizeTag bytesRead={response.bytesRead} bytesContent={response.bytesContent} />
          </div>
          <ResponseHistoryDropdown
            activeResponse={response}
            requestId={request._id}
            handleSetActiveResponse={handleSetActiveResponse}
            className="tall pane__header__right"
          />
        </PaneHeader>
      )}
      <Tabs
        className={classnames(paneBodyClasses, 'react-tabs')}
        onSelect={handleTabSelect}
        forceRenderTabPanel
      >
        <TabList>
          <Tab tabIndex="-1">
            <PreviewModeDropdown
              download={handleDownloadResponseBody}
              fullDownload={handleDownloadFullResponseBody}
              showPrettifyOption={response.contentType.includes('json')}
              copyToClipboard={handleCopyResponseToClipboard}
            />
          </Tab>
          <Tab tabIndex="-1">
            <Button>
              Header{' '}
              {response.headers.length > 0 && (
                <span className="bubble">{response.headers.length}</span>
              )}
            </Button>
          </Tab>
          <Tab tabIndex="-1">
            <Button>
              Cookie{' '}
              {cookieHeaders.length ? (
                <span className="bubble">{cookieHeaders.length}</span>
              ) : null}
            </Button>
          </Tab>
          <Tab tabIndex="-1">
            <Button>Timeline</Button>
          </Tab>
        </TabList>
        <TabPanel className="react-tabs__tab-panel">
          <ResponseViewer
            ref={responseViewerRef}
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
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel scrollable-container">
          <div className="scrollable pad">
            <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
              <ResponseHeadersViewer headers={response.headers} />
            </ErrorBoundary>
          </div>
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel scrollable-container">
          <div className="scrollable pad">
            <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
              <ResponseCookiesViewer
                handleShowRequestSettings={handleShowRequestSettings}
                cookiesSent={response.settingSendCookies}
                cookiesStored={response.settingStoreCookies}
                headers={cookieHeaders}
              />
            </ErrorBoundary>
          </div>
        </TabPanel>
        <TabPanel className="react-tabs__tab-panel">
          <ErrorBoundary key={response._id} errorClassName="font-error pad text-center">
            <ResponseTimelineViewer
              response={response}
            />
          </ErrorBoundary>
        </TabPanel>
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

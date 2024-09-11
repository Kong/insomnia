import fs from 'fs';
import { extension as mimeExtension } from 'mime-types';
import React, { type FC, useCallback, useMemo } from 'react';
import { Tab, TabList, TabPanel, Tabs, Toolbar } from 'react-aria-components';
import { useRouteLoaderData } from 'react-router-dom';

import { PREVIEW_MODE_SOURCE } from '../../../common/constants';
import { getSetCookieHeaders } from '../../../common/misc';
import * as models from '../../../models';
import { cancelRequestById } from '../../../network/cancellation';
import { jsonPrettify } from '../../../utils/prettify/json';
import { useExecutionState } from '../../hooks/use-execution-state';
import { useRequestMetaPatcher } from '../../hooks/use-request';
import type { RequestLoaderData } from '../../routes/request';
import { useRootLoaderData } from '../../routes/root';
import { PreviewModeDropdown } from '../dropdowns/preview-mode-dropdown';
import { ResponseHistoryDropdown } from '../dropdowns/response-history-dropdown';
import { MockResponseExtractor } from '../editors/mock-response-extractor';
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
import { RequestTestResultPane } from './request-test-result-pane';

interface Props {
  activeRequestId: string;
}
export const ResponsePane: FC<Props> = ({
  activeRequestId,
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

  const { isExecuting, steps } = useExecutionState({ requestId: activeRequest._id });

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

  const { passedTestCount, totalTestCount } = useMemo(() => {
    let passedTestCount = 0;
    let totalTestCount = 0;
    activeResponse?.requestTestResults.forEach(result => {
      if (result.status === 'passed') {
        passedTestCount++;
      }
      totalTestCount++;
    });
    return { passedTestCount, totalTestCount };
  }, [activeResponse]);
  const testResultCountTagColor = totalTestCount > 0 ?
    passedTestCount === totalTestCount ? 'bg-lime-600' : 'bg-red-600' :
    'bg-[var(--hl-sm)]';

  if (!activeRequest) {
    return <BlankPane type="response" />;
  }

  // If there is no previous response, show placeholder for loading indicator
  if (!activeResponse) {
    return (
      <PlaceholderResponsePane>
        {isExecuting && <ResponseTimer
          handleCancel={() => cancelRequestById(activeRequest._id)}
          activeRequestId={activeRequestId}
          steps={steps}
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
            <TimeTag milliseconds={activeResponse.elapsedTime} steps={steps} />
            <SizeTag bytesRead={activeResponse.bytesRead} bytesContent={activeResponse.bytesContent} />
          </div>
          <ResponseHistoryDropdown
            activeResponse={activeResponse}
          />
        </PaneHeader>
      )}
      <Tabs aria-label='Request group tabs' className="flex-1 w-full h-full flex flex-col">
        <TabList className='w-full flex-shrink-0  overflow-x-auto border-solid scro border-b border-b-[--hl-md] bg-[--color-bg] flex items-center h-[--line-height-sm]' aria-label='Request pane tabs'>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='preview'
          >
            Preview
          </Tab>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='headers'
          >
            Headers
            {activeResponse.headers.length > 0 && (
              <span className="p-2 aspect-square flex items-center justify-between border-solid border border-[--hl-md] overflow-hidden rounded-lg text-xs shadow-small">{activeResponse.headers.length}</span>
            )}
          </Tab>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='cookies'
          >
            Cookies
            {cookieHeaders.length > 0 && (
              <span className="p-2 aspect-square flex items-center justify-between border-solid border border-[--hl-md] overflow-hidden rounded-lg text-xs shadow-small">{cookieHeaders.length}</span>
            )}
          </Tab>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='test-results'
          >
            <div>
              <span>
                Tests
              </span>
              <span
                className={`rounded-sm ml-1 px-1 ${testResultCountTagColor}`}
                style={{ color: 'white' }}
              >
                {`${passedTestCount} / ${totalTestCount}`}
              </span>
            </div>
          </Tab>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='mock-response'
          >
            → Mock
          </Tab>
          <Tab
            className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
            id='timeline'
          >
            Console
          </Tab>
        </TabList>
        <TabPanel className='w-full flex-1 flex flex-col overflow-hidden' id='preview'>
          <Toolbar className="w-full flex-shrink-0 h-[--line-height-sm] border-b border-solid border-[--hl-md] flex items-center px-2">
            <PreviewModeDropdown
              download={handleDownloadResponseBody}
              copyToClipboard={handleCopyResponseToClipboard}
            />
          </Toolbar>
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
        </TabPanel>
        <TabPanel className='w-full flex-1 flex flex-col overflow-y-auto' id='headers'>
          <ErrorBoundary key={activeResponse._id} errorClassName="font-error pad text-center">
            <ResponseHeadersViewer headers={activeResponse.headers} />
          </ErrorBoundary>
        </TabPanel>
        <TabPanel className='w-full flex-1 flex flex-col overflow-y-auto' id='cookies'>
          <ErrorBoundary key={activeResponse._id} errorClassName="font-error pad text-center">
            <ResponseCookiesViewer
              cookiesSent={activeResponse.settingSendCookies}
              cookiesStored={activeResponse.settingStoreCookies}
              headers={cookieHeaders}
            />
          </ErrorBoundary>
        </TabPanel>
        <TabPanel
          className='w-full flex-1 flex flex-col overflow-y-auto'
          id='test-results'
        >
          <RequestTestResultPane requestTestResults={activeResponse.requestTestResults} />
        </TabPanel>
        <TabPanel
          className='w-full flex-1 flex flex-col overflow-y-auto'
          id='mock-response'
        >
          <MockResponseExtractor />
        </TabPanel>
        <TabPanel className='w-full flex-1 flex flex-col overflow-y-auto' id='timeline'>
          <ErrorBoundary key={activeResponse._id} errorClassName="font-error pad text-center">
            <ResponseTimelineViewer
              key={activeResponse._id}
              timeline={timeline}
            />
          </ErrorBoundary>
        </TabPanel>
      </Tabs>
      <ErrorBoundary errorClassName="font-error pad text-center">
        {isExecuting && <ResponseTimer
          handleCancel={() => cancelRequestById(activeRequest._id)}
          activeRequestId={activeRequestId}
          steps={steps}
        />}
      </ErrorBoundary>
    </Pane>
  );
};

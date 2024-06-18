import fs from 'fs';
import * as Har from 'har-format';
import React, { Fragment, useCallback, useEffect, useState } from 'react';
import { useRouteLoaderData } from 'react-router-dom';
import { useFetcher } from 'react-router-dom';
import { useInterval } from 'react-use';

import { getMockServiceURL, getPreviewModeName, PREVIEW_MODE_FRIENDLY, PREVIEW_MODES, PreviewMode } from '../../../common/constants';
import { exportHarCurrentRequest } from '../../../common/har';
import { ResponseTimelineEntry } from '../../../main/network/libcurl-promise';
import * as models from '../../../models';
import { MockRoute } from '../../../models/mock-route';
import { MockServer } from '../../../models/mock-server';
import { Response } from '../../../models/response';
import { cancelRequestById } from '../../../network/cancellation';
import { insomniaFetch } from '../../../ui/insomniaFetch';
import { jsonPrettify } from '../../../utils/prettify/json';
import { MockRouteLoaderData } from '../../routes/mock-route';
import { useRootLoaderData } from '../../routes/root';
import { Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { TabItem, Tabs } from '../base/tabs';
import { CodeEditor } from '../codemirror/code-editor';
import { Pane, PaneHeader } from '../panes/pane';
import { PlaceholderResponsePane } from '../panes/placeholder-response-pane';
import { ResponseTimer } from '../response-timer';
import { SizeTag } from '../tags/size-tag';
import { StatusTag } from '../tags/status-tag';
import { TimeTag } from '../tags/time-tag';
import { getTimeFromNow } from '../time-from-now';
import { ResponseHeadersViewer } from '../viewers/response-headers-viewer';
import { ResponseTimelineViewer } from '../viewers/response-timeline-viewer';
import { ResponseViewer } from '../viewers/response-viewer';

interface MockbinLogOutput {
  log: {
    version: string;
    creator: {
      name: string;
      version: string;
    };
    entries: [
      {
        startedDateTime: string;
        clientIPAddress: string;
        request: Har.Request;
      }
    ];
  };
}

export const MockResponsePane = () => {
  const { mockServer, mockRoute, activeResponse } = useRouteLoaderData(':mockRouteId') as MockRouteLoaderData;
  const { settings } = useRootLoaderData();
  const [timeline, setTimeline] = useState<ResponseTimelineEntry[]>([]);
  const [previewMode, setPreviewMode] = useState<PreviewMode>(PREVIEW_MODE_FRIENDLY);
  const requestFetcher = useFetcher({ key: 'mock-request-fetcher' });

  useEffect(() => {
    const fn = async () => {
      if (activeResponse) {
        const timeline = await models.response.getTimeline(activeResponse, true);
        setTimeline(timeline);
      }
    };
    fn();
  }, [activeResponse]);
  if (requestFetcher.state !== 'idle') {
    return (
      <PlaceholderResponsePane>
        {<ResponseTimer
          handleCancel={() => activeResponse && cancelRequestById(activeResponse.parentId)}
          activeRequestId={mockRoute._id}
        />}
      </PlaceholderResponsePane>
    );
  }
  return (
    <Pane type="response">
      {!activeResponse ? null : (
        <PaneHeader className="row-spaced">
          <div aria-atomic="true" aria-live="polite" className="no-wrap scrollable scrollable--no-bars pad-left">
            <StatusTag statusCode={activeResponse.statusCode} statusMessage={activeResponse.statusMessage} />
            <TimeTag milliseconds={activeResponse.elapsedTime} />
            <SizeTag bytesRead={activeResponse.bytesRead} bytesContent={activeResponse.bytesContent} />
          </div>
        </PaneHeader>
      )}
    <Tabs aria-label="Mock response">
      <TabItem
        key="preview"
        title={activeResponse ?
          <PreviewModeDropdown
            activeResponse={activeResponse}
            previewMode={previewMode}
            setPreviewMode={setPreviewMode}
          /> :
          'Preview'}
      >
        {activeResponse && <ResponseViewer
          key={activeResponse._id}
          bytes={Math.max(activeResponse.bytesContent, activeResponse.bytesRead)}
          contentType={activeResponse.contentType || ''}
          disableHtmlPreviewJs={settings.disableHtmlPreviewJs}
          disablePreviewLinks={settings.disableResponsePreviewLinks}
          download={() => { }}
          editorFontSize={settings.editorFontSize}
          error={activeResponse.error}
          filter={''}
          filterHistory={[]}
          getBody={() => models.response.getBodyBuffer(activeResponse)}
          previewMode={previewMode}
          responseId={activeResponse._id}
          updateFilter={activeResponse.error ? undefined : () => { }}
          url={activeResponse.url}
        />}
      </TabItem>
      <TabItem key="headers" title="Headers">
        <ResponseHeadersViewer headers={activeResponse?.headers || []} />
      </TabItem>
      <TabItem key="timeline" title="Timeline">
        <ResponseTimelineViewer
          key={activeResponse?._id}
          timeline={timeline}
          pinToBottom={true}
        />
      </TabItem>
      <TabItem key="history" title="History">
        <HistoryViewWrapperComponentFactory mockServer={mockServer} mockRoute={mockRoute} />
      </TabItem>
    </Tabs>
    </Pane>
  );
};

const HistoryViewWrapperComponentFactory = ({ mockServer, mockRoute }: { mockServer: MockServer; mockRoute: MockRoute }) => {
  const [logs, setLogs] = useState<MockbinLogOutput | null>(null);
  const [logEntryId, setLogEntryId] = useState<number | null>(null);
  const { userSession } = useRootLoaderData();

  const fetchLogs = useCallback(async () => {
    const compoundId = mockRoute.parentId + mockRoute.name;
    const mockbinUrl = mockServer.useInsomniaCloud ? getMockServiceURL() : mockServer.url;
    try {
      const res = await insomniaFetch<MockbinLogOutput>({
        origin: mockbinUrl,
        path: `/bin/log/${compoundId}`,
        method: 'GET',
        sessionId: userSession.id,
      });
      if (res?.log) {
        setLogs(res);
        return;
      }
      console.log('Error: fetching logs from remote', { mockbinUrl, res });
    } catch (e) {
      // network erros will be managed by the upsert trigger, so we can ignore them here
      console.log({ mockbinUrl, e });
    }
  }, [mockRoute.name, mockRoute.parentId, mockServer.url, mockServer.useInsomniaCloud, userSession.id]);
  // refetches logs whenever the path changes, or a response is recieved, or tenseconds elapses or history tab is click
  // chatgpt: answer my called
  useInterval(() => {
    fetchLogs();
  }, 10000);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="h-full w-full grid grid-rows-[repeat(auto-fit,minmax(0,1fr))]">
      <div className="w-full flex-1 overflow-hidden box-border overflow-y-scroll">
        <div className="grid grid-cols-[repeat(5,auto)] divide-solid divide-y divide-[--hl-sm]">
          <div className="uppercase p-2 bg-[--hl-sm] text-left text-xs font-semibold focus:outline-none">Method</div>
          <div className="uppercase p-2 bg-[--hl-sm] text-left text-xs font-semibold focus:outline-none">Size</div>
          <div className="uppercase p-2 bg-[--hl-sm] text-left text-xs font-semibold focus:outline-none">Date</div>
          <div className="uppercase p-2 bg-[--hl-sm] text-left text-xs font-semibold focus:outline-none">IP</div>
          <div className="uppercase p-2 bg-[--hl-sm] text-left text-xs font-semibold focus:outline-none">Path</div>
          {logs?.log.entries?.map((row, index) => (
            <Fragment key={row.startedDateTime}>
              <div onClick={() => setLogEntryId(index)} className={`${index % 2 === 0 ? '' : 'bg-[--hl-xs]'} cursor-pointer whitespace-nowrap text-sm truncate font-medium group-last-of-type:border-none focus:outline-none`}>
                <div className='p-2'>{row.request.method}</div>
              </div>
              <div onClick={() => setLogEntryId(index)} className={`${index % 2 === 0 ? '' : 'bg-[--hl-xs]'} cursor-pointer whitespace-nowrap text-sm truncate font-medium group-last-of-type:border-none focus:outline-none`}>
                <div className='p-2'>{row.request.bodySize + row.request.headersSize}</div></div>
              <div onClick={() => setLogEntryId(index)} className={`${index % 2 === 0 ? '' : 'bg-[--hl-xs]'} cursor-pointer whitespace-nowrap text-sm truncate font-medium group-last-of-type:border-none focus:outline-none`}>
                <div className='p-2 truncate'>{getTimeFromNow(row.startedDateTime, false)}</div>
              </div>
              <div onClick={() => setLogEntryId(index)} className={`${index % 2 === 0 ? '' : 'bg-[--hl-xs]'} cursor-pointer whitespace-nowrap text-sm truncate font-medium group-last-of-type:border-none focus:outline-none`}>
                <div className='p-2 truncate'>{row.clientIPAddress}</div>
              </div>
              <div onClick={() => setLogEntryId(index)} className={`${index % 2 === 0 ? '' : 'bg-[--hl-xs]'} cursor-pointer whitespace-nowrap truncate text-sm font-medium group-last-of-type:border-none focus:outline-none`}>
                <div className='p-2 truncate'>{row.request.url}</div>
              </div>
            </Fragment>
          )).reverse()}
        </div>
      </div>
      {logEntryId !== null && logs?.log.entries?.[logEntryId] && (
        <div className='flex-1 h-full border-solid border border-[--hl-md]'>
          <CodeEditor
            id="log-body-preview"
            key={logEntryId + logs?.log.entries?.[logEntryId].startedDateTime}
            hideLineNumbers
            mode={'text/json'}
            defaultValue={JSON.stringify(logs?.log.entries?.[logEntryId], null, '\t')}
            readOnly
          />
        </div>
      )}
    </div>
  );
};

const PreviewModeDropdown = ({ activeResponse, previewMode, setPreviewMode }: { activeResponse: Response; previewMode: PreviewMode; setPreviewMode: (mode: PreviewMode) => void }) => {
  return (
    <Dropdown
      aria-label='Preview Mode Dropdown'
      triggerButton={
        <DropdownButton className="tall !text-[--hl]">
          {getPreviewModeName(previewMode)}
          <i className="fa fa-caret-down space-left" />
        </DropdownButton>
      }
    >
      <DropdownSection
        aria-label='Preview Mode Section'
        title="Preview Mode"
      >
        {PREVIEW_MODES.map(mode =>
          <DropdownItem
            key={mode}
            aria-label={getPreviewModeName(mode, true)}
          >
            <ItemContent
              icon={previewMode === mode ? 'check' : 'empty'}
              label={getPreviewModeName(mode, true)}
              onClick={() => setPreviewMode(mode)}
            />
          </DropdownItem>
        )}
      </DropdownSection>
      <DropdownSection
        aria-label='Action Section'
        title="Action"
      >
        <DropdownItem aria-label='Copy raw response'>
          <ItemContent
            icon="copy"
            label="Copy raw response"
            onClick={async () => {
              const bodyBuffer = await models.response.getBodyBuffer(activeResponse);
              bodyBuffer && window.clipboard.writeText(bodyBuffer.toString('utf8'));
            }}
          />
        </DropdownItem>
        <DropdownItem aria-label='Export raw response'>
          <ItemContent
            icon="save"
            label="Export raw response"
            onClick={async () => {
              const bodyBuffer = await models.response.getBodyBuffer(activeResponse);
              const { canceled, filePath } = await window.dialog.showSaveDialog({
                title: 'Save Full Response',
                buttonLabel: 'Save',
                defaultPath: `response-${Date.now()}.txt`,
              });

              if (canceled || !filePath || !bodyBuffer) {
                return;
              }
              fs.promises.writeFile(filePath, bodyBuffer.toString('utf8'));
            }}
          />
        </DropdownItem>
        <DropdownItem aria-label='Export prettified response'>
          {activeResponse.contentType.includes('json') &&
            <ItemContent
              icon="save"
              label="Export prettified response"
              onClick={async () => {
                const bodyBuffer = await models.response.getBodyBuffer(activeResponse);
                const { canceled, filePath } = await window.dialog.showSaveDialog({
                  title: 'Save Full Response',
                  buttonLabel: 'Save',
                  defaultPath: `response-${Date.now()}.txt`,
                });

                if (canceled || !filePath || !bodyBuffer) {
                  return;
                }
                fs.promises.writeFile(filePath, jsonPrettify(bodyBuffer.toString('utf8')));
              }}
            />
          }
        </DropdownItem>
        <DropdownItem aria-label='Export HTTP debug'>
          <ItemContent
            icon="bug"
            label="Export HTTP debug"
            onClick={async () => {
              const { canceled, filePath } = await window.dialog.showSaveDialog({
                title: 'Save Full Response',
                buttonLabel: 'Save',
                defaultPath: `response-${Date.now()}.txt`,
              });

              if (canceled || !filePath) {
                return;
              }
              const timeline = models.response.getTimeline(activeResponse);
              const headers = timeline
                .filter(v => v.name === 'HeaderIn')
                .map(v => v.value)
                .join('');

              fs.promises.writeFile(filePath, headers);
            }}
          />
        </DropdownItem>
        <DropdownItem aria-label='Export as HAR'>
          <ItemContent
            icon="save"
            label="Export as HAR"
            onClick={async () => {
              const activeRequest = await models.request.getById(activeResponse.parentId);
              const { canceled, filePath } = await window.dialog.showSaveDialog({
                title: 'Save Full Response',
                buttonLabel: 'Save',
                defaultPath: `response-${Date.now()}.txt`,
              });

              if (canceled || !filePath || !activeRequest) {
                return;
              }
              const data = await exportHarCurrentRequest(activeRequest, activeResponse);
              const har = JSON.stringify(data, null, '\t');

              fs.promises.writeFile(filePath, har);
            }}
          />
        </DropdownItem>
      </DropdownSection>
    </Dropdown>
  );
};

import * as Har from 'har-format';
import React, { Fragment, useEffect, useState } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { getCurrentSessionId } from '../../../account/session';
import { getMockServiceURL, PREVIEW_MODE_SOURCE } from '../../../common/constants';
import { ResponseTimelineEntry } from '../../../main/network/libcurl-promise';
import * as models from '../../../models';
import { MockRouteLoaderData } from '../../routes/mock-route';
import { useRootLoaderData } from '../../routes/root';
import { TabItem, Tabs } from '../base/tabs';
import { CodeEditor } from '../codemirror/code-editor';
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
  const [logs, setLogs] = useState<MockbinLogOutput | null>(null);
  const [timeline, setTimeline] = useState<ResponseTimelineEntry[]>([]);
  const [logEntryId, setLogEntryId] = useState<number | null>(null);

  // refetches logs whenever the path changes, or a response is recieved
  useEffect(() => {
    const mockbinUrl = mockServer.useInsomniaCloud ? getMockServiceURL() : mockServer.url;

    const fn = async () => {
      const compoundId = mockRoute.parentId + mockRoute.name;
      try {
        const res = await window.main.insomniaFetch<MockbinLogOutput>({
          origin: mockbinUrl,
          path: `/bin/log/${compoundId}`,
          method: 'GET',
          sessionId: getCurrentSessionId(),
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
    };
    fn();
  }, [activeResponse?._id, mockRoute.name, mockRoute.parentId, mockServer.url, mockServer.useInsomniaCloud]);

  useEffect(() => {
    const fn = async () => {
      if (activeResponse) {
        const timeline = await models.response.getTimeline(activeResponse, true);
        setTimeline(timeline);
      }
    };
    fn();
  }, [activeResponse]);

  return (
    <Tabs aria-label="Mock response">
      <TabItem key="history" title="History">
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
      </TabItem>
      <TabItem key="preview" title="Preview">
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
          previewMode={PREVIEW_MODE_SOURCE}
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
    </Tabs>
  );
};

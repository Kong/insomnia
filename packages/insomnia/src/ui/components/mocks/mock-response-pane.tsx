import { AxiosResponse } from 'axios';
import React, { Fragment, useEffect, useState } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { PREVIEW_MODE_SOURCE } from '../../../common/constants';
import { HarRequest } from '../../../common/har';
import { ResponseTimelineEntry } from '../../../main/network/libcurl-promise';
import * as models from '../../../models';
import { MockRouteLoaderData } from '../../routes/mock-route';
import { useRootLoaderData } from '../../routes/root';
import { TabItem, Tabs } from '../base/tabs';
import { getTimeFromNow } from '../time-from-now';
import { ResponseHeadersViewer } from '../viewers/response-headers-viewer';
import { ResponseTimelineViewer } from '../viewers/response-timeline-viewer';
import { ResponseViewer } from '../viewers/response-viewer';
const mockbinUrl = 'http://localhost:8080';
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
        request: HarRequest;
      }
    ];
  };
}
export const MockResponsePane = () => {
  const { mockRoute, activeResponse } = useRouteLoaderData(':mockRouteId') as MockRouteLoaderData;
  const { settings } = useRootLoaderData();
  const getLogById = async (binId: string): Promise<MockbinLogOutput | null> => {
    if (!binId) {
      return null;
    };
    try {
      const res = await window.main.axiosRequest({
        url: mockbinUrl + `/bin/log/${binId}`,
        method: 'get',
      }) as unknown as AxiosResponse<MockbinLogOutput>;
      // todo: handle error better
      if (res?.data?.log) {
        return res.data;
      }
    } catch (e) {
      console.log(e);
    }
    console.log('Error: creating fetching log on remote');
    return null;

  };
  const [logs, setLogs] = useState<MockbinLogOutput | null>(null);
  const [timeline, setTimeline] = useState<ResponseTimelineEntry[]>([]);
  useEffect(() => {
    const fn = async () => {
      if (mockRoute?.binId) {
        const logs = await getLogById(mockRoute.binId + mockRoute.path);
        setLogs(logs);
      }
    };
    fn();
  }, [mockRoute.binId, activeResponse?._id, mockRoute.path]);
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
        <div className="divide-solid divide-y divide-[--hl-sm] grid [grid-template-columns:repeat(5,auto)]">
          <div className="uppercase p-2 bg-[--hl-sm] text-left text-xs font-semibold focus:outline-none">Method</div>
          <div className="uppercase p-2 bg-[--hl-sm] text-left text-xs font-semibold focus:outline-none">Size</div>
          <div className="uppercase p-2 bg-[--hl-sm] text-left text-xs font-semibold focus:outline-none">Date</div>
          <div className="uppercase p-2 bg-[--hl-sm] text-left text-xs font-semibold focus:outline-none">IP</div>
          <div className="uppercase p-2 bg-[--hl-sm] text-left text-xs font-semibold focus:outline-none">Path</div>
          {logs?.log.entries?.map((row, index) => (
            <Fragment key={row.startedDateTime}>
              <div className={`${index % 2 === 0 ? '' : 'bg-[--hl-xs]'} whitespace-nowrap text-sm truncate font-medium group-last-of-type:border-none focus:outline-none`}>
                <div className='p-2'>{row.request.method}</div>
              </div>
              <div className={`${index % 2 === 0 ? '' : 'bg-[--hl-xs]'} whitespace-nowrap text-sm truncate font-medium group-last-of-type:border-none focus:outline-none`}>
                <div className='p-2'>{row.request.bodySize + row.request.headersSize}</div></div>
              <div className={`${index % 2 === 0 ? '' : 'bg-[--hl-xs]'} whitespace-nowrap text-sm truncate font-medium group-last-of-type:border-none focus:outline-none`}>
                <div className='p-2 truncate'>{getTimeFromNow(row.startedDateTime, false)}</div>
              </div>
              <div className={`${index % 2 === 0 ? '' : 'bg-[--hl-xs]'} whitespace-nowrap text-sm truncate font-medium group-last-of-type:border-none focus:outline-none`}>
                <div className='p-2 truncate'>{row.clientIPAddress}</div>
              </div>
              <div className={`${index % 2 === 0 ? '' : 'bg-[--hl-xs]'} whitespace-nowrap truncate text-sm font-medium group-last-of-type:border-none focus:outline-none`}>
                <div className='p-2 truncate'>{row.request.url}</div>
              </div>
            </Fragment>
          )).reverse()}
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

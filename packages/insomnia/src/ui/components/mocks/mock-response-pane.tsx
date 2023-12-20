import { AxiosResponse } from 'axios';
import React, { useEffect, useState } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { PREVIEW_MODE_SOURCE } from '../../../common/constants';
import { HarRequest } from '../../../common/har';
import { ResponseTimelineEntry } from '../../../main/network/libcurl-promise';
import * as models from '../../../models';
import { MockRouteLoaderData } from '../../routes/mock-route';
import { useRootLoaderData } from '../../routes/root';
import { TabItem, Tabs } from '../base/tabs';
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
        url: mockbinUrl + `/bin/${binId}/log`,
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
        const logs = await getLogById(mockRoute.binId);
        setLogs(logs);
      }
    };
    fn();
  }, [mockRoute.binId, activeResponse?._id]);
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
        <div className="flex">
          <table className="table--fancy table--striped table--compact selectable">
            <thead>
              <tr>
                <th>Method</th>
                <th>Date</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs?.log.entries?.map(row => (
                <tr key={row.startedDateTime}>
                  <td>{row.request.method}</td>
                  <td>{row.startedDateTime}</td>
                  <td>{row.clientIPAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
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

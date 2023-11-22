import { AxiosResponse } from 'axios';
import React, { useEffect, useState } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { PREVIEW_MODE_SOURCE } from '../../../common/constants';
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
        request: {
          'method': string;
          'url': string;
          'httpVersion': string;
          'cookies': { name: string; value: string }[];
          'headers': { name: string; value: string }[];
          'queryString': { name: string; value: string }[];
          'postData': {
            'mimeType': string;
            'text': string;
            'params': { name: string; value: string }[];
          };
          'headersSize': number;
          'bodySize': number;
        };
      }
    ];
  };
}
export const MockResponsePane = () => {
  const { mockRoute, activeResponse } = useRouteLoaderData(':mockRouteId') as MockRouteLoaderData;
  const { settings } = useRootLoaderData();
  console.log({ activeResponse });
  const getLogById = async (id: string): Promise<MockbinLogOutput | null> => {
    console.log({ id });
    if (!id) {
      return null;
    };
    try {
      const res = await window.main.axiosRequest({
        url: mockbinUrl + `/bin/${id}/log`,
        method: 'get',
      }) as unknown as AxiosResponse<MockbinLogOutput>;
      // todo: handle error better
      // todo create/update current bin url
      // console.log({ res });
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
  const [timeline, setTimeline] = useState<ResponseTimelineEntry[]>(null);
  useEffect(() => {
    const fn = async () => {
      const logs = await getLogById(mockRoute.bins?.[mockRoute.bins.length - 1]?.binId);
      console.log(logs?.log.entries);
      setLogs(logs);
      if (activeResponse) {
        const timeline = await models.response.getTimeline(activeResponse, true);
        setTimeline(timeline);
      }
    };
    fn();
  }, [mockRoute.bins]);

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
              {logs?.log.entries?.map((row, i) => (
                <tr key={i}>
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

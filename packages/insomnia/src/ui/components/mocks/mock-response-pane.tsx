import { AxiosResponse } from 'axios';
import React, { useEffect, useState } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { MockRouteLoaderData } from '../../routes/mock-route';
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
  const { mockRoute } = useRouteLoaderData(':mockRouteId') as MockRouteLoaderData;

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
      console.log({ res });
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
  useEffect(() => {
    const fn = async () => {
      const logs = await getLogById(mockRoute.bins?.[0]?.binId);
      console.log(logs?.log.entries);
      setLogs(logs);
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
        {/* <ResponseViewer
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
        /> */}
      </TabItem>
      <TabItem key="headers" title="Headers">
        {/* // todo: use headers from mockbin */}
        <ResponseHeadersViewer headers={mockRoute.headers} />
      </TabItem>
      <TabItem key="timeline" title="Timeline">
        <ResponseTimelineViewer
          // key={response._id}
          timeline={[]}
          pinToBottom={true}
        />
      </TabItem>
    </Tabs>
  );
};

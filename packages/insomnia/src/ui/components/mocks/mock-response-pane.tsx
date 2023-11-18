import { AxiosResponse } from 'axios';
import React, { useEffect, useState } from 'react';
import { useRouteLoaderData } from 'react-router-dom';

import { MockRouteLoaderData } from '../../routes/mock-route';
import { TabItem, Tabs } from '../base/tabs';
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
        preview
      </TabItem>
      <TabItem key="headers" title="Headers">
        headers
      </TabItem>
      <TabItem key="timeline" title="Timeline">
        timeline
      </TabItem>
    </Tabs>
  );
};

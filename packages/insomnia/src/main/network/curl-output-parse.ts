import fs from 'node:fs';

import type { ResponseHeader } from '../../models/response';
import type { HeaderResult } from './libcurl-promise';
export const parseCurlHeaders = (input: string): HeaderResult => {
  const lines = input.split('\n');
  let version = '';
  let code = 0;
  let reason = '';
  const headers: ResponseHeader[] = [];

  lines.forEach(line => {
    if (line.startsWith('<= Recv header')) {
      const headerLine = lines[lines.indexOf(line) + 1];
      if (headerLine) {
        const headerMatch = headerLine.match(/^0000: (.+)$/);
        if (headerMatch) {
          const headerText = headerMatch[1];
          if (headerText.startsWith('HTTP/')) {
            const statusLine = headerText.split(' ');
            version = statusLine[0];
            code = parseInt(statusLine[1], 10);
            reason = statusLine.slice(2).join(' ');
          } else {
            const separatorIndex = headerText.indexOf(':');
            if (separatorIndex !== -1) {
              const name = headerText.slice(0, Math.max(0, separatorIndex)).trim();
              const value = headerText.slice(Math.max(0, separatorIndex + 1)).trim();
              headers.push({ name, value });
            }
          }
        }
      }
    }
  });

  return {
    version,
    code,
    reason,
    headers,
  };
};

// TODO fill in these objects from the output
export const readResponseFromFile = async (filePath: string) => {
  const output = await fs.promises.readFile(filePath, 'utf8');
  return {
    patch: {
      bytesContent: 32,
      bytesRead: 32,
      elapsedTime: 704.554,
      url: 'http://httpbin.org/ip',
    },
    debugTimeline: [
      { value: 'Preparing request to http://localhost:4010/echo', name: 'Text', timestamp: 1726673977726 },
      { value: 'Current time is 2024-09-18T15:39:37.726Z', name: 'Text', timestamp: 1726673977726 },
      { value: 'Enable automatic URL encoding', name: 'Text', timestamp: 1726673977726 },
      { value: 'Using default HTTP version', name: 'Text', timestamp: 1726673977726 },
      { value: 'Enable timeout of 60000ms', name: 'Text', timestamp: 1726673977726 },
      { value: 'Disable SSL validation', name: 'Text', timestamp: 1726673977726 },
      {
        name: 'Text',
        value: 'Found bundle for host localhost: 0x1100572af40 [serially]\n',
        timestamp: 1726673977726,
      },
      { name: 'Text', value: 'Can not multiplex, even if we wanted to!\n', timestamp: 1726673977726 },
      { name: 'Text', value: 'Re-using existing connection! (#1) with host localhost\n', timestamp: 1726673977726 },
      { name: 'Text', value: 'Connected to localhost (127.0.0.1) port 4010 (#1)\n', timestamp: 1726673977726 },
      {
        name: 'HeaderOut',
        value: 'GET /echo HTTP/1.1\r\nHost: localhost:4010\r\nUser-Agent: insomnia/10.0.0\r\nAccept: */*\r\n\r\n',
        timestamp: 1726673977726,
      },
      { name: 'Text', value: 'Mark bundle as not supporting multiuse\n', timestamp: 1726673977727 },
      { name: 'HeaderIn', value: 'HTTP/1.1 200 OK\r\n', timestamp: 1726673977727 },
      { name: 'HeaderIn', value: 'X-Powered-By: Express\r\n', timestamp: 1726673977727 },
      { name: 'HeaderIn', value: 'Content-Type: application/json; charset=utf-8\r\n', timestamp: 1726673977727 },
      { name: 'HeaderIn', value: 'Content-Length: 136\r\n', timestamp: 1726673977727 },
      { name: 'HeaderIn', value: 'ETag: W/"88-pcozdDf2fxFCyJg5sNPO9yD/8QQ"\r\n', timestamp: 1726673977727 },
      { name: 'HeaderIn', value: 'Date: Wed, 18 Sep 2024 15:39:37 GMT\r\n', timestamp: 1726673977727 },
      { name: 'HeaderIn', value: 'Connection: keep-alive\r\n', timestamp: 1726673977727 },
      { name: 'HeaderIn', value: 'Keep-Alive: timeout=5\r\n', timestamp: 1726673977727 },
      { name: 'HeaderIn', value: '\r\n', timestamp: 1726673977727 },
      { name: 'Text', value: 'Received 136 B chunk', timestamp: 1726673977727 },
      { name: 'Text', value: 'Connection #1 to host localhost left intact\n', timestamp: 1726673977727 },
    ],
    headerResults: [parseCurlHeaders(output)],
    bodyPath: filePath,
  };
};

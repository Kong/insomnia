import { app, protocol } from 'electron';
import http from 'http';
import https from 'https';

import { getApiBaseURL } from '../common/constants';

export interface RegisterProtocolOptions {
  scheme: string;
}

const RETRY_TIMEOUT = 1000;

export async function registerInsomniaStreamProtocol(
  { scheme }: RegisterProtocolOptions,
) {
  await app.whenReady();

  if (protocol.isProtocolRegistered(scheme)) {
    return;
  }

  protocol.registerStreamProtocol(scheme, async function(request, callback) {
    const url = new URL(`${getApiBaseURL()}/${request.url.replace(`${scheme}://`, '')}`);

    const client = url.protocol === 'https:' ? https : http;

    const sendRequest = () => {
      const req = client.request({
        method: request.method,
        headers: request.headers,
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
      }, response => {
        if (response.statusCode === 204) {
          return callback({ statusCode: 204 });
        }

        if (response.statusCode !== 200) {
          setTimeout(() => {
            sendRequest();
          }, RETRY_TIMEOUT);
        }

        callback(response);
      });

      req.on('error', () => {
        setTimeout(() => {
          sendRequest();
        }, RETRY_TIMEOUT);
      });

      req.on('close', () => {
        setTimeout(() => {
          sendRequest();
        }, RETRY_TIMEOUT);
      });
    };

    sendRequest();
  });
}

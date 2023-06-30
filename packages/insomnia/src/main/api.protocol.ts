import { app, protocol } from 'electron';
import type { IncomingMessage } from 'http';
import http from 'http';

import { getApiBaseURL } from '../common/constants';

export interface RegisterProtocolOptions {
  scheme: string;
}

export async function registerInsomniaAPIProtocol(
  { scheme }: RegisterProtocolOptions,
) {
  await app.whenReady();

  if (protocol.isProtocolRegistered(scheme)) {
    return;
  }

  console.log('Registering protocol', scheme);

  protocol.registerBufferProtocol(scheme, async function(request, callback) {
    const url = new URL(`${getApiBaseURL()}/${request.url.replace(`${scheme}://`, '')}`);

    console.log('Loading resource', url, request);

    const response = await new Promise<IncomingMessage>(resolve => {
      const req = http.request({
        method: request.method,
        headers: request.headers,
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
      }, resolve);

      req.on('error', err => {
        console.error('Failed to load resource', err);
        callback({ statusCode: 500 });
      });

      request.uploadData?.forEach(data => {
        console.log('Writing request', data.bytes);
        req.write(data.bytes);
      });

      return req.end();
    });

    const { statusCode, headers } = response;

    console.log('Loaded resource', statusCode, headers);

    if (statusCode === 404) {
      return callback({ statusCode });
    }

    const chunks: Buffer[] = [];

    response.on('data', chunk => chunks.push(chunk));
    response.on('end', () => {
      const buffer = Buffer.concat(chunks);
      console.log('Loaded resource', buffer);
      callback({ statusCode, headers: headers as Record<string, string>, data: buffer });
    });

    response.on('error', err => {
      console.error('Failed to load resource', err);
      callback({ statusCode: 500 });
    });
  });
}

export async function registerInsomniaStreamProtocol(
  { scheme }: RegisterProtocolOptions,
) {
  await app.whenReady();

  if (protocol.isProtocolRegistered(scheme)) {
    return;
  }

  console.log('Registering STREAM protocol', scheme);

  protocol.registerStreamProtocol(scheme, async function(request, callback) {
    const url = new URL(`${getApiBaseURL()}/${request.url.replace(`${scheme}://`, '')}`);

    console.log('Loading resource STREAM', url, request);

    const req = http.request({
      method: request.method,
      headers: request.headers,
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
    }, res => {
      console.log('Loaded resource STREAM', res);
      callback(res);
    });

    req.on('error', err => {
      console.error('Failed to load resource', err);
      callback({ statusCode: 500 });
    });

    // request.uploadData?.forEach(data => {
    //   console.log('Writing request STREAM', data.bytes);
    //   req.write(data.bytes);
    // });

    req.end();

    // res.on('data', chunk => {
    //   console.log('Loaded resource STREAM', chunk);
    //   callback({ data: chunk });
    // });

    // callback(res);
  });
}

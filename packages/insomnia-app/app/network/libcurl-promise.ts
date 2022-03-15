// NOTE: this file should not be imported by electron renderer because node-libcurl is not-context-aware
// Related issue https://github.com/JCMais/node-libcurl/issues/155
if (process.type === 'renderer') throw new Error('node-libcurl unavailable in renderer');

import { Curl, CurlCode, CurlFeature, CurlInfoDebug } from '@getinsomnia/node-libcurl';
import fs from 'fs';
import { Readable, Writable } from 'stream';
import { ValueOf } from 'type-fest';

import { describeByteSize } from '../common/misc';
import { ResponseHeader } from '../models/response';
import { ResponsePatch } from './network';

// wraps libcurl with a promise taking curl options and others required by read, write and debug callbacks
// returning a response patch, debug timeline and list of headers for each redirect

interface CurlOpt {
  key: Parameters<Curl['setOpt']>[0];
  value: Parameters<Curl['setOpt']>[1];
}

interface CurlRequestOptions {
  curlOptions: CurlOpt[];
  responseBodyPath: string;
  maxTimelineDataSizeKB: number;
  requestId: string; // for cancellation
  requestBodyPath?: string; // only used for POST file path
  isMultipart: boolean; // for clean up after implemention side effect
}

interface ResponseTimelineEntry {
  name: ValueOf<typeof LIBCURL_DEBUG_MIGRATION_MAP>;
  timestamp: number;
  value: string;
}

interface CurlRequestOutput {
  patch: ResponsePatch;
  debugTimeline: ResponseTimelineEntry[];
  headerResults: HeaderResult[];
}

// NOTE: this is a dictionary of functions to close open listeners
const cancelCurlRequestHandlers = {};
export const cancelCurlRequest = id => cancelCurlRequestHandlers[id]();
export const curlRequest = (options: CurlRequestOptions) => new Promise<CurlRequestOutput>(async resolve => {
  try {
    // Create instance and handlers, poke value options in, set up write and debug callbacks, listen for events
    const { curlOptions, responseBodyPath, requestBodyPath, maxTimelineDataSizeKB, requestId, isMultipart } = options;
    const curl = new Curl();
    let requestFileDescriptor;
    const responseBodyWriteStream = fs.createWriteStream(responseBodyPath);
    // cancel request by id map
    cancelCurlRequestHandlers[requestId] = () => {
      if (requestFileDescriptor && responseBodyPath) {
        closeReadFunction(requestFileDescriptor, isMultipart, requestBodyPath);
      }
      curl.close();
    };
    // set the string and number options from network.ts
    curlOptions.forEach(opt => curl.setOpt(opt.key, opt.value));
    // read file into request and close file desriptor
    if (requestBodyPath) {
      requestFileDescriptor = fs.openSync(requestBodyPath, 'r');
      curl.setOpt(Curl.option.READDATA, requestFileDescriptor);
      curl.on('end', () => closeReadFunction(requestFileDescriptor, isMultipart, requestBodyPath));
      curl.on('error', () => closeReadFunction(requestFileDescriptor, isMultipart, requestBodyPath));
    }

    // set up response writer
    let responseBodyBytes = 0;
    curl.setOpt(Curl.option.WRITEFUNCTION, buffer => {
      responseBodyBytes += buffer.length;
      responseBodyWriteStream.write(buffer);
      return buffer.length;
    });
    // set up response logger
    const debugTimeline: ResponseTimelineEntry[] = [];
    curl.setOpt(Curl.option.DEBUGFUNCTION, (infoType, buffer) => {
      const rawName = Object.keys(CurlInfoDebug).find(k => CurlInfoDebug[k] === infoType) || '';
      const infoTypeName = LIBCURL_DEBUG_MIGRATION_MAP[rawName] || rawName;

      const isSSLData = infoType === CurlInfoDebug.SslDataIn || infoType === CurlInfoDebug.SslDataOut;
      const isEmpty = buffer.length === 0;
      // Don't show cookie setting because this will display every domain in the jar
      const isAddCookie = infoType === CurlInfoDebug.Text && buffer.toString('utf8').indexOf('Added cookie') === 0;
      if (isSSLData || isEmpty || isAddCookie) {
        return 0;
      }

      let value;
      if (infoType === CurlInfoDebug.DataOut) {
        // Ignore the possibly large data messages
        const lessThan10KB = buffer.length / 1024 < maxTimelineDataSizeKB || 10;
        value = lessThan10KB ? buffer.toString('utf8') : `(${describeByteSize(buffer.length)} hidden)`;
      }
      if (infoType === CurlInfoDebug.DataIn) {
        value = `Received ${describeByteSize(buffer.length)} chunk`;
      }

      debugTimeline.push({
        name: infoType === CurlInfoDebug.DataIn ? 'TEXT' : infoTypeName,
        value: value || buffer.toString('utf8'),
        timestamp: Date.now(),
      });
      return 0; // Must be here
    });

    // makes rawHeaders a buffer, rather than HeaderInfo[]
    curl.enable(CurlFeature.Raw);
    // NOTE: legacy write end callback
    curl.on('end', () => responseBodyWriteStream.end());
    curl.on('end', async (_1, _2, rawHeaders: Buffer) => {
      const patch = {
        bytesContent: responseBodyBytes,
        bytesRead: curl.getInfo(Curl.info.SIZE_DOWNLOAD) as number,
        elapsedTime: curl.getInfo(Curl.info.TOTAL_TIME) as number * 1000,
        url: curl.getInfo(Curl.info.EFFECTIVE_URL) as string,
      };
      curl.close();
      await waitForStreamToFinish(responseBodyWriteStream);

      const headerResults = _parseHeaders(rawHeaders);
      resolve({ patch, debugTimeline, headerResults });
    });
    // NOTE: legacy write end callback
    curl.on('error', () => responseBodyWriteStream.end());
    curl.on('error', async function(err, code) {
      const elapsedTime = curl.getInfo(Curl.info.TOTAL_TIME) as number * 1000;
      curl.close();
      await waitForStreamToFinish(responseBodyWriteStream);

      let error = err + '';
      let statusMessage = 'Error';

      if (code === CurlCode.CURLE_ABORTED_BY_CALLBACK) {
        error = 'Request aborted';
        statusMessage = 'Abort';
      }
      const patch = {
        statusMessage,
        error: error || 'Something went wrong',
        elapsedTime,
      };

      // NOTE: legacy, default headerResults
      resolve({ patch, debugTimeline, headerResults: [{ version: '', code: 0, reason: '', headers: [] }] });
    });
    curl.perform();
  } catch (e) {
    const patch = {
      statusMessage: 'Error',
      error: e.message || 'Something went wrong',
      elapsedTime: 0,
    };
    resolve({ patch, debugTimeline: [], headerResults: [{ version: '', code: 0, reason: '', headers: [] }] });
  }
});

const closeReadFunction = (fd: number, isMultipart: boolean, path?: string) => {
  fs.closeSync(fd);
  // NOTE: multipart files are combined before sending, so this file is deleted after
  // alt implemention to send one part at a time https://github.com/JCMais/node-libcurl/blob/develop/examples/04-multi.js
  if (isMultipart && path) fs.unlink(path, () => { });
};

// Because node-libcurl changed some names that we used in the timeline
const LIBCURL_DEBUG_MIGRATION_MAP = {
  HeaderIn: 'HEADER_IN',
  DataIn: 'DATA_IN',
  SslDataIn: 'SSL_DATA_IN',
  HeaderOut: 'HEADER_OUT',
  DataOut: 'DATA_OUT',
  SslDataOut: 'SSL_DATA_OUT',
  Text: 'TEXT',
  '': '',
};

interface HeaderResult {
  headers: ResponseHeader[];
  version: string;
  code: number;
  reason: string;
}
// NOTE: legacy, has tests, could be simplified
export function _parseHeaders(buffer: Buffer) {
  const results: HeaderResult[] = [];
  const lines = buffer.toString('utf8').split(/\r?\n|\r/g);

  for (let i = 0, currentResult: HeaderResult | null = null; i < lines.length; i++) {
    const line = lines[i];
    const isEmptyLine = line.trim() === '';

    // If we hit an empty line, start parsing the next response
    if (isEmptyLine && currentResult) {
      results.push(currentResult);
      currentResult = null;
      continue;
    }

    if (!currentResult) {
      const [version, code, ...other] = line.split(/ +/g);
      currentResult = {
        version,
        code: parseInt(code, 10),
        reason: other.join(' '),
        headers: [],
      };
    } else {
      const [name, value] = line.split(/:\s(.+)/);
      const header: ResponseHeader = {
        name,
        value: value || '',
      };
      currentResult.headers.push(header);
    }
  }

  return results;
}
// NOTE: legacy, suspicious, could be simplified
async function waitForStreamToFinish(stream: Readable | Writable) {
  return new Promise<void>(resolve => {
    // @ts-expect-error -- access of internal values that are intended to be private.  We should _not_ do this.
    if (stream._readableState?.finished) {
      return resolve();
    }

    // @ts-expect-error -- access of internal values that are intended to be private.  We should _not_ do this.
    if (stream._writableState?.finished) {
      return resolve();
    }

    stream.on('close', () => {
      resolve();
    });
    stream.on('error', () => {
      resolve();
    });
  });
}

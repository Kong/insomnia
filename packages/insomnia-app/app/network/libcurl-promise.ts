// assertion: ipc bridge cannot serialise functions so write and debug callbacks need to be simplified
// assertion: if logic like cancellation doesn't work we won't build it in this scope

// assumption: options are typechecked and don't need run time feedback.
// therefore we can build a list of options and apply them at once.

// assumption: settings timeline object can split into setup and debug timelines
// therefore I can just pass back what happened during debug to the respond function above

// overview: behaviours tightly coupled to node-libcurl implementation
// write response to file return path to file
// write debug output to timeline array
// getInfo time taken size and url
// expose a fire and forget close instance for cancel
// on error: close filewriter/s, close curl instance, save timeline return error message
// on end: close filewriter/s, close curl instance, set cookies, save timeline, return transformed headers, status
import { Curl, CurlCode, CurlFeature, CurlInfoDebug } from '@getinsomnia/node-libcurl';
import fs from 'fs';
import { ValueOf } from 'type-fest';

import { describeByteSize } from '../common/misc';
import { ResponseHeader } from '../models/response';
import { ResponsePatch } from './network';

// wraps libcurl with a promise taking options, path to response file, and max timeline size
// returning a response patch, debug timeline and headerArray
interface CurlOutput {
  patch: ResponsePatch;
  debugTimeline: ResponseTimelineEntry[];
  headerArray: HeaderResult[];
}

type CurlSetOptParameters = Parameters<Curl['setOpt']>;
type CurlSetOptName = CurlSetOptParameters[0];
type CurlSetOptValue = CurlSetOptParameters[1];
const functionmap = {};
export const cancelLibCurlPromise = id => functionmap[id]();
export const libCurlPromise = (options: Record<CurlSetOptName, CurlSetOptValue>, bodyPath, maxTimelineDataSizeKB, cancelId) => new Promise<CurlOutput>(async resolve => {
  // Create instance, poke value options in, set up write and debug callbacks, listen for events
  const curl = new Curl();
  functionmap[cancelId] = () => curl.close();
  Object.entries(options).forEach(([k, v]: [CurlSetOptName, CurlSetOptValue]) => curl.setOpt(k, v));

  let responseBodyBytes = 0;
  const responseBodyWriteStream = fs.createWriteStream(bodyPath);
  curl.setOpt(Curl.option.WRITEFUNCTION, buff => {
    responseBodyBytes += buff.length;
    responseBodyWriteStream.write(buff);
    return buff.length;
  });

  const debugTimeline: any = [];
  curl.setOpt(Curl.option.DEBUGFUNCTION, (infoType, contentBuffer) => {
    const rawName = Object.keys(CurlInfoDebug).find(k => CurlInfoDebug[k] === infoType) || '';
    const name = LIBCURL_DEBUG_MIGRATION_MAP[rawName] || rawName;

    const isSSLData = infoType === CurlInfoDebug.SslDataIn || infoType === CurlInfoDebug.SslDataOut;
    const isEmpty = contentBuffer.length === 0;
    // Don't show cookie setting because this will display every domain in the jar
    const isAddCookie = infoType === CurlInfoDebug.Text && contentBuffer.toString('utf8').indexOf('Added cookie') === 0;
    if (isSSLData || isEmpty || isAddCookie) {
      return 0;
    }

    // Ignore the possibly large data messages
    if (infoType === CurlInfoDebug.DataOut) {
      const lessThan10KB = contentBuffer.length / 1024 < maxTimelineDataSizeKB || 10;
      debugTimeline.push({
        name,
        value: lessThan10KB ? contentBuffer.toString('utf8') : `(${describeByteSize(contentBuffer.length)} hidden)`,
        timestamp: Date.now(),
      });
      return 0;
    }

    if (infoType === CurlInfoDebug.DataIn) {
      debugTimeline.push({
        name: 'TEXT',
        value: `Received ${describeByteSize(contentBuffer.length)} chunk`,
        timestamp: Date.now(),
      });
      return 0;
    }

    debugTimeline.push({
      name,
      value: contentBuffer.toString('utf8'),
      timestamp: Date.now(),
    });
    return 0; // Must be here
  });

  curl.enable(CurlFeature.Raw); // makes rawHeaders a buffer, rather than HeaderInfo[]
  curl.on('end', () => responseBodyWriteStream.end());
  curl.on('end', async (_1, _2, rawHeaders: Buffer) => {
    const patch = {
      bytesContent: responseBodyBytes,
      bytesRead: curl.getInfo(Curl.info.SIZE_DOWNLOAD) as number,
      elapsedTime: curl.getInfo(Curl.info.TOTAL_TIME) as number * 1000,
      url: curl.getInfo(Curl.info.EFFECTIVE_URL) as string,
    };
    curl.close();
    responseBodyWriteStream.end();
    await waitForStreamToFinish(responseBodyWriteStream);

    const headerArray = _parseHeaders(rawHeaders);
    resolve({ patch, debugTimeline, headerArray });
  });
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

    resolve({ patch, debugTimeline, headerArray: [{ version:'', code:-1, reason:'', headers:[] }] });
  });
  curl.perform();
});

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

interface ResponseTimelineEntry {
  name: ValueOf<typeof LIBCURL_DEBUG_MIGRATION_MAP>;
  timestamp: number;
  value: string;
}
interface HeaderResult {
  headers: ResponseHeader[];
  version: string;
  code: number;
  reason: string;
}

export function _parseHeaders(
  buffer: Buffer,
) {
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

export async function waitForStreamToFinish(stream: Readable | Writable) {
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

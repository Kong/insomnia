// NOTE: this file should not be imported by electron renderer
import { invariant } from '../../utils/invariant';
invariant(process.type !== 'renderer', 'Native abstractions for Nodejs module unavailable in renderer');

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { parse as urlParse } from 'node:url';

import { isValid } from 'date-fns';
import electron from 'electron';
import { v4 as uuidv4 } from 'uuid';

import { version } from '../../../package.json';
import {
  AUTH_AWS_IAM,
  AUTH_DIGEST,
  AUTH_NETRC,
  AUTH_NTLM,
  CONTENT_TYPE_FORM_DATA,
  CONTENT_TYPE_FORM_URLENCODED,
} from '../../common/constants';
import { hasAuthHeader } from '../../common/misc';
import type { ClientCertificate } from '../../models/client-certificate';
import type { RequestHeader } from '../../models/request';
import type { ResponseHeader } from '../../models/response';
import { buildMultipart } from './multipart';
import { parseHeaderStrings } from './parse-header-strings';

export interface CurlRequestOptions {
  requestId: string; // for cancellation
  req: RequestUsedHere;
  finalUrl: string;
  settings: SettingsUsedHere;
  certificates: ClientCertificate[];
  caCertficatePath: string | null;
  socketPath?: string;
  authHeader?: { name: string; value: string };
  // make libcurl not decompress the response content
  noDecompress?: boolean;
}

interface RequestUsedHere {
  headers: any;
  method: string;
  body: { mimeType?: string | null };
  authentication: Record<string, any>;
  settingFollowRedirects: 'global' | 'on' | 'off';
  settingRebuildPath: boolean;
  settingSendCookies: boolean;
  url: string;
  cookieJar: any;
  cookies: { name: string; value: string }[];
  suppressUserAgent: boolean;
}

interface SettingsUsedHere {
  preferredHttpVersion: string;
  maxRedirects: number;
  proxyEnabled: boolean;
  timeout: number;
  validateSSL: boolean;
  followRedirects: boolean;
  maxTimelineDataSizeKB: number;
  httpProxy: string;
  httpsProxy: string;
  noProxy: string;
}

export interface ResponseTimelineEntry {
  name: string;
  timestamp: number;
  value: string;
}

export interface CurlRequestOutput {
  patch: ResponsePatch;
  debugTimeline: ResponseTimelineEntry[];
  headerResults: HeaderResult[];
  responseBodyPath?: string;
}

export interface ResponsePatch {
  bodyCompression?: 'zip' | null;
  bodyPath?: string;
  bytesContent?: number;
  bytesRead?: number;
  contentType?: string;
  elapsedTime: number;
  environmentId?: string | null;
  globalEnvironmentId?: string | null;
  error?: string;
  headers?: ResponseHeader[];
  httpVersion?: string;
  message?: string;
  parentId?: string;
  settingSendCookies?: boolean;
  settingStoreCookies?: boolean;
  statusCode?: number;
  statusMessage?: string;
  timelinePath?: string;
  url?: string;
}

const getDataDirectory = () => process.env.INSOMNIA_DATA_PATH || electron.app.getPath('userData');

// NOTE: this is a dictionary of functions to close open listeners
const cancelCurlRequestHandlers: Record<string, () => void> = {};
export const cancelCurlRequest = (id: string) => cancelCurlRequestHandlers[id]();

export const curlRequest = (options: CurlRequestOptions) =>
  new Promise<CurlRequestOutput>(resolve => {
    (async () => {
      try {
        const responsesDir = path.join(getDataDirectory(), 'responses');
        // TODO: remove this check, its only used for network.test.ts
        await fs.promises.mkdir(responsesDir, { recursive: true });
        const responseBodyPath = path.join(responsesDir, uuidv4() + '.response');

        const {
          requestId,
          req,
          finalUrl,
          settings,
          certificates,
          caCertficatePath,
          socketPath,
          authHeader,
          noDecompress = false,
        } = options;
        const caCert = caCertficatePath && (await fs.promises.readFile(caCertficatePath)).toString();

        const { curlArgs, debugTimeline } = createCurlArguments({
          req,
          finalUrl,
          settings,
          caCert,
          certificates,
          socketPath,
          noDecompress,
        });

        const { method, body } = req;

        // Handle request body
        const requestBodyPath = await parseRequestBodyPath(body);
        const requestBody = parseRequestBody({ body, method });
        const isMultipart = body.mimeType === CONTENT_TYPE_FORM_DATA && requestBodyPath;

        // Set method-specific arguments
        if (method.toUpperCase() === 'HEAD') {
          curlArgs.push('--head');
        } else if (method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'POST') {
          curlArgs.push('--request', method);
        }

        // Handle body data
        if (requestBodyPath) {
          // AWS IAM file upload not supported
          invariant(
            req.authentication.type !== AUTH_AWS_IAM,
            'AWS authentication not supported for provided body type',
          );
          curlArgs.push('--data-binary', `@${requestBodyPath}`);
        } else if (requestBody !== undefined) {
          curlArgs.push('--data', requestBody);
        }

        // NOTE: temporary workaround for testing mockbin api
        if (process.env.PLAYWRIGHT) {
          req.headers = [...req.headers, { name: 'X-Mockbin-Test', value: 'true' }];
        }

        const headerStrings = parseHeaderStrings({ req, requestBody, requestBodyPath, finalUrl, authHeader });
        headerStrings.forEach((header: string) => {
          curlArgs.push('--header', header);
        });

        // Add output file
        curlArgs.push('--output', responseBodyPath);

        // Add verbose and dump headers
        curlArgs.push('--verbose');
        curlArgs.push('--dump-header', path.join(responsesDir, uuidv4() + '.headers'));

        // Track timings and debug info
        const startTime = Date.now();
        let responseBodyBytes = 0;
        let effectiveUrl = finalUrl;
        let totalTime = 0;

        // Create curl process
        const curlProcess = spawn('curl', curlArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
        });

        let stderrOutput = '';
        let stdoutOutput = '';

        // Handle cancellation
        cancelCurlRequestHandlers[requestId] = () => {
          curlProcess.kill('SIGTERM');
          if (requestBodyPath && isMultipart) {
            fs.unlink(requestBodyPath, () => {});
          }
        };

        // Collect stderr for debug info
        curlProcess.stderr?.on('data', (data: Buffer) => {
          stderrOutput += data.toString();
          debugTimeline.push({
            name: 'Text',
            value: data.toString(),
            timestamp: Date.now(),
          });
        });

        // Collect stdout (not used with --output, but just in case)
        curlProcess.stdout?.on('data', (data: Buffer) => {
          stdoutOutput += data.toString();
        });

        curlProcess.on('close', async code => {
          totalTime = Date.now() - startTime;

          try {
            // Read response body to get size
            const stats = await fs.promises.stat(responseBodyPath);
            responseBodyBytes = stats.size;
          } catch {
            responseBodyBytes = 0;
          }

          // Parse effective URL from stderr
          const effectiveUrlMatch = stderrOutput.match(/< Location: (.+)/);
          if (effectiveUrlMatch) {
            effectiveUrl = effectiveUrlMatch[1].trim();
          }

          // Parse headers from header dump file
          const headerDumpPath = curlArgs[curlArgs.indexOf('--dump-header') + 1];
          let headerResults: HeaderResult[] = [];

          try {
            const headerContent = await fs.promises.readFile(headerDumpPath, 'utf8');
            headerResults = _parseHeaders(Buffer.from(headerContent));
            // Clean up header dump file
            fs.unlink(headerDumpPath, () => {});
          } catch {
            headerResults = [{ version: '', code: 0, reason: '', headers: [] }];
          }

          if (code === 0) {
            // Success
            const patch = {
              bytesContent: responseBodyBytes,
              bytesRead: responseBodyBytes,
              elapsedTime: totalTime,
              url: effectiveUrl,
            };
            resolve({ patch, debugTimeline, headerResults, responseBodyPath });
          } else {
            // Error
            let error = `curl exited with code ${code}`;
            let statusMessage = 'Error';

            // Parse error from stderr
            if (stderrOutput.includes('Operation was aborted by an application callback')) {
              error = 'Request aborted';
              statusMessage = 'Abort';
            } else if (stderrOutput.includes('timeout')) {
              error = 'Request timeout';
              statusMessage = 'Timeout';
            }

            // If libcurl can't decompress the response, retry without decompression
            if (stderrOutput.includes('bad content encoding') && !noDecompress) {
              resolve(curlRequest({ ...options, noDecompress: true }));
              return;
            }

            const patch = {
              statusMessage,
              error: error || 'Something went wrong',
              elapsedTime: totalTime,
            };

            resolve({ patch, debugTimeline, headerResults: [{ version: '', code: 0, reason: '', headers: [] }] });
          }

          // Clean up multipart file if needed
          if (isMultipart && requestBodyPath) {
            fs.unlink(requestBodyPath, () => {});
          }
        });

        curlProcess.on('error', async err => {
          totalTime = Date.now() - startTime;

          const patch = {
            statusMessage: 'Error',
            error: err.message || 'Something went wrong',
            elapsedTime: totalTime,
          };
          resolve({ patch, debugTimeline, headerResults: [{ version: '', code: 0, reason: '', headers: [] }] });
        });
      } catch (error: any) {
        console.error(error);
        const patch = {
          statusMessage: 'Error',
          error: error.message || 'Something went wrong',
          elapsedTime: 0,
        };
        resolve({ patch, debugTimeline: [], headerResults: [{ version: '', code: 0, reason: '', headers: [] }] });
      }
    })();
  });

export const createCurlArguments = ({
  req,
  finalUrl,
  settings,
  caCert,
  certificates,
  socketPath,
  noDecompress = false,
}: {
  req: RequestUsedHere;
  finalUrl: string;
  settings: SettingsUsedHere;
  certificates: ClientCertificate[];
  caCert: string | null;
  socketPath?: string;
  noDecompress?: boolean;
}) => {
  const debugTimeline: ResponseTimelineEntry[] = [];
  const curlArgs: string[] = [];

  // Basic URL
  curlArgs.push(finalUrl);

  // Unix socket path
  if (socketPath) {
    curlArgs.push('--unix-socket', socketPath);
  }

  // Compression
  if (!noDecompress) {
    curlArgs.push('--compressed');
  }

  // CA certificate
  if (caCert) {
    const caCertPath = path.join(getDataDirectory(), 'ca-cert.pem');
    fs.writeFileSync(caCertPath, caCert);
    curlArgs.push('--cacert', caCertPath);
  }

  // Client certificates
  certificates.forEach(validCert => {
    const { passphrase, cert, key, pfx } = validCert;
    if (cert) {
      curlArgs.push('--cert', cert);
      curlArgs.push('--cert-type', 'PEM');
      debugTimeline.push({ value: 'Adding SSL PEM certificate', name: 'Text', timestamp: Date.now() });
    }
    if (pfx) {
      curlArgs.push('--cert', pfx);
      curlArgs.push('--cert-type', 'P12');
      debugTimeline.push({ value: 'Adding SSL P12 certificate', name: 'Text', timestamp: Date.now() });
    }
    if (key) {
      curlArgs.push('--key', key);
      debugTimeline.push({ value: 'Adding SSL KEY certificate', name: 'Text', timestamp: Date.now() });
    }
    if (passphrase) {
      curlArgs.push('--pass', passphrase);
    }
  });

  // HTTP version
  const httpVersion = getHttpVersion(settings.preferredHttpVersion);
  debugTimeline.push({ value: httpVersion.log, name: 'Text', timestamp: Date.now() });

  if (httpVersion.curlFlag) {
    curlArgs.push(httpVersion.curlFlag);
  }

  // Redirects
  if (settings.maxRedirects > 0) {
    curlArgs.push('--max-redirs', settings.maxRedirects.toString());
  }

  // Proxy settings
  if (!settings.proxyEnabled) {
    curlArgs.push('--noproxy', '*');
  } else {
    const { protocol } = urlParse(req.url);
    const { httpProxy, httpsProxy, noProxy } = settings;
    const proxyHost = protocol === 'https:' ? httpsProxy : httpProxy;
    const proxy = proxyHost ? setDefaultProtocol(proxyHost) : null;
    debugTimeline.push({ value: `Enable network proxy for ${protocol || ''}`, name: 'Text', timestamp: Date.now() });
    if (proxy) {
      curlArgs.push('--proxy', proxy);
      curlArgs.push('--proxy-anyauth');
    }
    if (noProxy) {
      curlArgs.push('--noproxy', noProxy);
    }
  }

  // Timeout
  const { timeout } = settings;
  if (timeout > 0) {
    curlArgs.push('--max-time', Math.ceil(timeout / 1000).toString());
    debugTimeline.push({ value: `Enable timeout of ${timeout}ms`, name: 'Text', timestamp: Date.now() });
  }

  // SSL validation
  const { validateSSL } = settings;
  if (!validateSSL) {
    curlArgs.push('--insecure');
  }
  debugTimeline.push({
    value: `${validateSSL ? 'Enable' : 'Disable'} SSL validation`,
    name: 'Text',
    timestamp: Date.now(),
  });

  // Follow redirects
  const followRedirects =
    {
      off: false,
      on: true,
      global: settings.followRedirects,
    }[req.settingFollowRedirects] ?? true;

  if (followRedirects) {
    curlArgs.push('--location');
  }

  // Path handling
  if (!req.settingRebuildPath) {
    curlArgs.push('--path-as-is');
  }

  // Cookies
  if (req.settingSendCookies) {
    const { cookieJar, cookies } = req;

    // Add individual cookies
    for (const { name, value } of cookies) {
      curlArgs.push('--cookie', `${name}=${value}`);
    }

    // Add cookies from jar
    if (cookieJar.cookies.length) {
      debugTimeline.push({
        value: `Enable cookie sending with jar of ${cookieJar.cookies.length} cookie${cookieJar.cookies.length !== 1 ? 's' : ''}`,
        name: 'Text',
        timestamp: Date.now(),
      });

      // Create temporary cookie jar file
      const cookieJarPath = path.join(getDataDirectory(), 'temp-cookies.txt');
      const cookieLines = ['# Netscape HTTP Cookie File'];

      for (const cookie of cookieJar.cookies) {
        const cookieLine = [
          cookie.httpOnly ? `#HttpOnly_${cookie.domain}` : cookie.domain,
          cookie.hostOnly ? 'FALSE' : 'TRUE',
          cookie.path,
          cookie.secure ? 'TRUE' : 'FALSE',
          cookie.expires && isValid(new Date(cookie.expires))
            ? Math.round(new Date(cookie.expires).getTime() / 1000)
            : 0,
          cookie.key,
          cookie.value,
        ].join('\t');
        cookieLines.push(cookieLine);
      }

      fs.writeFileSync(cookieJarPath, cookieLines.join('\n'));
      curlArgs.push('--cookie', cookieJarPath);
    }
  }

  // User agent
  const { headers, authentication } = req;
  const userAgent: RequestHeader | null = headers.find((h: any) => h.name.toLowerCase() === 'user-agent') || null;
  const userAgentOrFallback = typeof userAgent?.value === 'string' ? userAgent?.value : 'insomnia/' + version;

  if (req.suppressUserAgent) {
    curlArgs.push('--user-agent', '');
  } else {
    curlArgs.push('--user-agent', userAgentOrFallback);
  }

  // Authentication
  const { username, password, disabled } = authentication;
  const isDigest = authentication.type === AUTH_DIGEST;
  const isNLTM = authentication.type === AUTH_NTLM;
  const isDigestOrNLTM = isDigest || isNLTM;

  if (!hasAuthHeader(headers) && !disabled && isDigestOrNLTM) {
    if (isDigest) {
      curlArgs.push('--digest');
    } else if (isNLTM) {
      curlArgs.push('--ntlm');
    }
    curlArgs.push('--user', `${username || ''}:${password || ''}`);
  }

  if (authentication.type === AUTH_NETRC) {
    curlArgs.push('--netrc-optional');
  }

  return { curlArgs, debugTimeline };
};

export interface HeaderResult {
  headers: ResponseHeader[];
  version: string;
  code: number;
  reason: string;
}

export function _parseHeaders(buffer: Buffer): HeaderResult[] {
  // split on two new lines
  const redirects = buffer.toString('utf8').split(/\r?\n\r?\n|\r\r/g);
  return redirects
    .filter(r => !!r.trim())
    .map(redirect => {
      // split on one new line
      const [first, ...rest] = redirect.split(/\r?\n|\r/g);
      const headers = rest
        .map(l => l.split(/:\s(.+)/))
        .filter(([n]) => !!n)
        .map(([name, value = '']) => ({ name, value }));

      const [version, code, ...other] = first.split(/ +/g);
      return {
        version,
        code: parseInt(code, 10),
        reason: other.join(' '),
        headers,
      };
    });
}

const parseRequestBody = ({ body, method }: { body: any; method: string }) => {
  const isUrlEncodedForm = body.mimeType === CONTENT_TYPE_FORM_URLENCODED;
  const expectsBody = ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase());
  const hasMimetypeAndUpdateMethod = typeof body.mimeType === 'string' || expectsBody;
  if (isUrlEncodedForm) {
    const urlSearchParams = new URLSearchParams();
    (body.params || []).map((p: { name: string; value: any }) => urlSearchParams.append(p.name, p?.value || ''));
    return urlSearchParams.toString();
  }

  if (hasMimetypeAndUpdateMethod) {
    return body.text || '';
  }

  return undefined;
};

const parseRequestBodyPath = async (body: any) => {
  const isMultipartForm = body.mimeType === CONTENT_TYPE_FORM_DATA;
  if (!isMultipartForm) {
    return body.fileName;
  }
  const { filePath } = await buildMultipart(body.params || []);
  return filePath;
};

export const getHttpVersion = (preferredHttpVersion: string) => {
  switch (preferredHttpVersion) {
    case 'V1_0': {
      return { log: 'Using HTTP 1.0', curlFlag: '--http1.0' };
    }
    case 'V1_1': {
      return { log: 'Using HTTP 1.1', curlFlag: '--http1.1' };
    }
    case 'V2PriorKnowledge': {
      return { log: 'Using HTTP/2 PriorKnowledge', curlFlag: '--http2-prior-knowledge' };
    }
    case 'V2_0': {
      return { log: 'Using HTTP/2', curlFlag: '--http2' };
    }
    case 'v3': {
      return { log: 'Using HTTP/3', curlFlag: '--http3' };
    }
    case 'default': {
      return { log: 'Using default HTTP version' };
    }
    default: {
      return { log: `Unknown HTTP version specified ${preferredHttpVersion}` };
    }
  }
};

export const setDefaultProtocol = (url: string, defaultProto?: string) => {
  const trimmedUrl = url.trim();
  defaultProto = defaultProto || 'http:';

  // If no url, don't bother returning anything
  if (!trimmedUrl) {
    return '';
  }

  // Default the proto if it doesn't exist
  if (!trimmedUrl.includes('://')) {
    return `${defaultProto}//${trimmedUrl}`;
  }

  return trimmedUrl;
};

import electron from 'electron';
import mkdirp from 'mkdirp';
import mimes from 'mime-types';
import {parse as urlParse} from 'url';
import {Curl} from 'node-libcurl';
import {join as pathJoin} from 'path';
import * as models from '../models';
import * as querystring from '../common/querystring';
import * as util from '../common/misc.js';
import {AUTH_BASIC, AUTH_DIGEST, AUTH_NTLM, CONTENT_TYPE_FORM_DATA, CONTENT_TYPE_FORM_URLENCODED, DEBOUNCE_MILLIS, getAppVersion} from '../common/constants';
import {describeByteSize, hasAcceptHeader, hasAuthHeader, hasUserAgentHeader, setDefaultProtocol} from '../common/misc';
import {getRenderedRequest} from '../common/render';
import fs from 'fs';
import * as db from '../common/database';
import * as CACerts from './cacert';
import {getAuthHeader} from './authentication';

let cancelRequestFunction = null;

export function cancelCurrentRequest () {
  if (typeof cancelRequestFunction === 'function') {
    cancelRequestFunction();
  }
}

export function _actuallySend (renderedRequest, workspace, settings) {
  return new Promise(async resolve => {
    function handleError (err, prefix = null) {
      resolve({
        url: renderedRequest.url,
        parentId: renderedRequest._id,
        error: prefix ? `${prefix}: ${err.message}` : err.message,
        elapsedTime: 0,
        statusMessage: 'Error',
        settingSendCookies: renderedRequest.settingSendCookies,
        settingStoreCookies: renderedRequest.settingStoreCookies
      });
    }

    try {
      // Initialize the curl handle
      const curl = new Curl();
      let timeline = [];

      // Define helper to add base fields when responding
      const respond = patch => {
        resolve(Object.assign({
          parentId: renderedRequest._id,
          timeline: timeline,
          settingSendCookies: renderedRequest.settingSendCookies,
          settingStoreCookies: renderedRequest.settingStoreCookies
        }, patch));
      };

      // Define helper to setOpt for better error handling
      const setOpt = (opt, val, optional = false) => {
        const name = Object.keys(Curl.option).find(name => Curl.option[name] === opt);
        try {
          curl.setOpt(opt, val);
        } catch (err) {
          if (!optional) {
            throw new Error(`${err.message} (${opt} ${name || 'n/a'})`);
          } else {
            console.warn(`Failed to set optional Curl opt (${opt} ${name || 'n/a'})`);
          }
        }
      };

      const setOptionalOpt = (opt, val) => setOpt(opt, val, true);

      // Setup the cancellation logic
      cancelRequestFunction = () => {
        respond({
          elapsedTime: curl.getInfo(Curl.info.TOTAL_TIME) * 1000,
          bytesRead: curl.getInfo(Curl.info.SIZE_DOWNLOAD),
          url: curl.getInfo(Curl.info.EFFECTIVE_URL),
          statusMessage: 'Cancelled',
          error: 'Request was cancelled'
        });

        // Kill it!
        curl.close();
      };

      // Set all the basic options
      setOpt(Curl.option.CUSTOMREQUEST, renderedRequest.method);
      setOpt(Curl.option.FOLLOWLOCATION, settings.followRedirects);
      setOpt(Curl.option.TIMEOUT_MS, settings.timeout); // 0 for no timeout
      setOpt(Curl.option.VERBOSE, true); // True so debug function works
      setOpt(Curl.option.NOPROGRESS, false); // False so progress function works

      // Setup debug handler
      setOpt(Curl.option.DEBUGFUNCTION, (infoType, content) => {
        const name = Object.keys(Curl.info.debug).find(k => Curl.info.debug[k] === infoType);

        if (
          infoType === Curl.info.debug.SSL_DATA_IN ||
          infoType === Curl.info.debug.SSL_DATA_OUT
        ) {
          return 0;
        }

        // Ignore the possibly large data messages
        if (infoType === Curl.info.debug.DATA_OUT) {
          if (content.length < 1000) {
            timeline.push({name, value: content});
          } else {
            timeline.push({name, value: `(${describeByteSize(content.length)} hidden)`});
          }
          return 0;
        }

        if (infoType === Curl.info.debug.DATA_IN) {
          timeline.push({
            name: 'TEXT',
            value: `Received ${describeByteSize(content.length)} chunk`
          });
          return 0;
        }

        // Don't show cookie setting because this will display every domain in the jar
        if (infoType === Curl.info.debug.TEXT && content.indexOf('Added cookie') === 0) {
          return 0;
        }

        timeline.push({name, value: content});

        return 0; // Must be here
      });

      // Set the headers (to be modified as we go)
      const headers = [...renderedRequest.headers];

      let lastPercent = 0;
      // NOTE: This option was added in 7.32.0 so make it optional
      setOptionalOpt(Curl.option.XFERINFOFUNCTION, (dltotal, dlnow, ultotal, ulnow) => {
        if (dltotal === 0) {
          return 0;
        }

        const percent = Math.round(dlnow / dltotal * 100);
        if (percent !== lastPercent) {
          // console.log('PROGRESS 2', `${percent}%`, ultotal, ulnow);
          lastPercent = percent;
        }

        return 0;
      });

      // Set the URL, including the query parameters
      const qs = querystring.buildFromParams(renderedRequest.parameters);
      const url = querystring.joinUrl(renderedRequest.url, qs);
      const finalUrl = util.prepareUrlForSending(url, renderedRequest.settingEncodeUrl);
      setOpt(Curl.option.URL, finalUrl);
      timeline.push({name: 'TEXT', value: 'Preparing request to ' + finalUrl});

      // log some things
      if (renderedRequest.settingEncodeUrl) {
        timeline.push({name: 'TEXT', value: 'Enable automatic URL encoding'});
      } else {
        timeline.push({name: 'TEXT', value: 'Disable automatic URL encoding'});
      }

      // SSL Validation
      if (settings.validateSSL) {
        timeline.push({name: 'TEXT', value: 'Enable SSL validation'});
      } else {
        setOpt(Curl.option.SSL_VERIFYHOST, 0);
        setOpt(Curl.option.SSL_VERIFYPEER, 0);
        timeline.push({name: 'TEXT', value: 'Disable SSL validation'});
      }

      // Setup CA Root Certificates if not on Mac. Thanks to libcurl, Mac will use
      // certificates form the OS.
      if (process.platform !== 'darwin') {
        const basCAPath = pathJoin(electron.remote.app.getPath('temp'), 'insomnia');
        const fullCAPath = pathJoin(basCAPath, CACerts.filename);

        try {
          fs.statSync(fullCAPath);
        } catch (err) {
          // Doesn't exist yet, so write it
          mkdirp.sync(basCAPath);
          fs.writeFileSync(fullCAPath, CACerts.blob);
          console.log('[net] Set CA to', fullCAPath);
        }

        setOpt(Curl.option.CAINFO, fullCAPath);
      }

      // Set cookies
      if (renderedRequest.settingSendCookies) {
        setOpt(Curl.option.COOKIEFILE, ''); // Enable cookies
        const cookies = renderedRequest.cookieJar.cookies || [];
        for (const cookie of cookies) {
          let expiresTimestamp = 0;
          if (cookie.expires) {
            const expiresDate = new Date(cookie.expires);
            expiresTimestamp = Math.round(expiresDate.getTime() / 1000);
          }
          setOpt(Curl.option.COOKIELIST, [
            cookie.httpOnly ? `#HttpOnly_${cookie.domain}` : cookie.domain,
            cookie.hostOnly ? 'TRUE' : 'FALSE',
            cookie.path,
            cookie.secure ? 'TRUE' : 'FALSE',
            expiresTimestamp,
            cookie.key,
            cookie.value
          ].join('\t'));
        }

        timeline.push({
          name: 'TEXT',
          value: 'Enable cookie sending with jar of ' +
          `${cookies.length} cookie${cookies.length !== 1 ? 's' : ''}`
        });
      } else {
        timeline.push({
          name: 'TEXT',
          value: 'Disable cookie sending due to user setting'
        });
      }

      // Set proxy settings if we have them
      if (settings.proxyEnabled) {
        const {protocol} = urlParse(renderedRequest.url);
        const {httpProxy, httpsProxy} = settings;
        const proxyHost = protocol === 'https:' ? httpsProxy : httpProxy;
        const proxy = proxyHost ? setDefaultProtocol(proxyHost) : null;
        timeline.push({name: 'TEXT', value: `Enable network proxy for ${protocol}`});
        if (proxy) {
          setOpt(Curl.option.PROXY, proxy);
          setOpt(Curl.option.PROXYAUTH, Curl.auth.ANY);
        }
      } else {
        setOpt(Curl.option.PROXY, '');
      }

      // Set client certs if needed
      for (const certificate of workspace.certificates) {
        const cHostWithProtocol = setDefaultProtocol(certificate.host, 'https:');
        const {hostname: cHostname, port: cPort} = urlParse(cHostWithProtocol);
        const {hostname, port} = urlParse(renderedRequest.url);

        const assumedPort = parseInt(port) || 443;
        const assumedCPort = parseInt(cPort) || 443;

        // Exact host match (includes port)
        if (cHostname === hostname && assumedCPort === assumedPort) {
          const ensureFile = blobOrFilename => {
            if (blobOrFilename.indexOf('/') === 0) {
              return blobOrFilename;
            } else {
              // Legacy support. Certs used to be stored in blobs, so lets write it to
              // the temp directory first.
              // TODO: Delete this fallback eventually
              const fullBase = pathJoin(electron.remote.app.getPath('temp'), 'insomnia');
              mkdirp.sync(fullBase);

              const name = `${renderedRequest._id}_${renderedRequest.modified}`;
              const fullPath = pathJoin(fullBase, name);
              fs.writeFileSync(fullPath, new Buffer(blobOrFilename, 'base64'));

              return fullPath;
            }
          };

          const {passphrase, cert, key, pfx} = certificate;

          if (cert) {
            setOpt(Curl.option.SSLCERT, ensureFile(cert));
            setOpt(Curl.option.SSLCERTTYPE, 'PEM');
            timeline.push({name: 'TEXT', value: 'Adding SSL PEM certificate'});
          }

          if (pfx) {
            setOpt(Curl.option.SSLCERT, ensureFile(pfx));
            setOpt(Curl.option.SSLCERTTYPE, 'P12');
            timeline.push({name: 'TEXT', value: 'Adding SSL P12 certificate'});
          }

          if (key) {
            setOpt(Curl.option.SSLKEY, ensureFile(key));
            timeline.push({name: 'TEXT', value: 'Adding SSL KEY certificate'});
          }

          if (passphrase) {
            setOpt(Curl.option.KEYPASSWD, passphrase);
          }
        }
      }

      // Build the body
      let noBody = false;
      if (renderedRequest.body.mimeType === CONTENT_TYPE_FORM_URLENCODED) {
        const d = querystring.buildFromParams(renderedRequest.body.params || [], true);
        setOpt(Curl.option.POSTFIELDS, d); // Send raw data
      } else if (renderedRequest.body.mimeType === CONTENT_TYPE_FORM_DATA) {
        const data = renderedRequest.body.params.map(param => {
          if (param.type === 'file' && param.fileName) {
            return {name: param.name, file: param.fileName, type: mimes.lookup(param.fileName)};
          } else {
            return {name: param.name, contents: param.value};
          }
        });
        setOpt(Curl.option.HTTPPOST, data);
      } else if (renderedRequest.body.fileName) {
        const {size} = fs.statSync(renderedRequest.body.fileName);
        headers.push({name: 'Content-Length', value: `${size}`});
        const fd = fs.openSync(renderedRequest.body.fileName, 'r+');
        setOpt(Curl.option.UPLOAD, 1);
        setOpt(Curl.option.READDATA, fd);
        const fn = () => fs.closeSync(fd);
        curl.on('end', fn);
        curl.on('error', fn);
      } else if (typeof renderedRequest.body.text === 'string') {
        setOpt(Curl.option.POSTFIELDS, renderedRequest.body.text);
      } else {
        // No body
        noBody = true;
      }

      if (!noBody) {
        // Don't chunk uploads
        headers.push({name: 'Expect', value: ''});
        headers.push({name: 'Transfer-Encoding', value: ''});
      }

      // Build the body
      const dataBuffers = [];
      let dataBuffersLength = 0;
      curl.on('data', chunk => {
        dataBuffers.push(chunk);
        dataBuffersLength += chunk.length;
      });

      // Handle Authorization header
      if (!hasAuthHeader(renderedRequest.headers) && !renderedRequest.authentication.disabled) {
        if (renderedRequest.authentication.type === AUTH_BASIC) {
          const {username, password} = renderedRequest.authentication;
          setOpt(Curl.option.HTTPAUTH, Curl.auth.BASIC);
          setOpt(Curl.option.USERNAME, username || '');
          setOpt(Curl.option.PASSWORD, password || '');
        } else if (renderedRequest.authentication.type === AUTH_DIGEST) {
          const {username, password} = renderedRequest.authentication;
          setOpt(Curl.option.HTTPAUTH, Curl.auth.DIGEST);
          setOpt(Curl.option.USERNAME, username || '');
          setOpt(Curl.option.PASSWORD, password || '');
        } else if (renderedRequest.authentication.type === AUTH_NTLM) {
          const {username, password} = renderedRequest.authentication;
          setOpt(Curl.option.HTTPAUTH, Curl.auth.NTLM);
          setOpt(Curl.option.USERNAME, username || '');
          setOpt(Curl.option.PASSWORD, password || '');
        } else {
          const authHeader = await getAuthHeader(
            renderedRequest._id,
            renderedRequest.authentication
          );

          if (authHeader) {
            headers.push(authHeader);
          }
        }
      }

      // NOTE: This is last because headers might be modified multiple times
      const headerStrings = headers
        .filter(h => h.name)
        .map(h => `${(h.name || '').trim()}: ${h.value}`);
      setOpt(Curl.option.HTTPHEADER, headerStrings);

      // Set User-Agent if it't not already in headers
      if (!hasUserAgentHeader(renderedRequest.headers)) {
        setOpt(Curl.option.USERAGENT, `insomnia/${getAppVersion()}`);
      }

      // Set Accept encoding
      if (!hasAcceptHeader(renderedRequest.headers)) {
        setOpt(Curl.option.ENCODING, ''); // Accept anything
      }

      // Handle the response ending
      curl.on('end', function (_1, _2, curlHeaders) {
        // Headers are an array (one for each redirect)
        curlHeaders = curlHeaders[curlHeaders.length - 1];

        // Collect various things
        const result = curlHeaders && curlHeaders.result;
        const statusCode = result ? result.code : 0;
        const statusMessage = result ? result.reason : 'Unknown';

        // Collect the headers
        const headers = [];
        for (const name of curlHeaders ? Object.keys(curlHeaders) : []) {
          if (typeof curlHeaders[name] === 'string') {
            headers.push({name, value: curlHeaders[name]});
          } else if (Array.isArray(curlHeaders[name])) {
            for (const value of curlHeaders[name]) {
              headers.push({name, value});
            }
          }
        }

        // Calculate the content type
        const contentTypeHeader = util.getContentTypeHeader(headers);
        const contentType = contentTypeHeader ? contentTypeHeader.value : '';

        // Update Cookie Jar
        const cookieStrings = curl.getInfo(Curl.info.COOKIELIST);
        if (renderedRequest.settingStoreCookies) {
          const cookies = cookieStrings.map(str => {
            //  0                    1                  2     3       4       5     6
            // [#HttpOnly_.hostname, includeSubdomains, path, secure, expiry, name, value]
            const parts = str.split('\t');

            const hostname = parts[0].replace(/^#HttpOnly_/, '');
            const httpOnly = hostname.length !== parts[0].length;

            return {
              domain: hostname,
              httpOnly: httpOnly,
              hostOnly: parts[1] === 'TRUE',
              path: parts[2],
              secure: parts[3] === 'TRUE', // This doesn't exists?
              expires: new Date(parts[4] * 1000),
              key: parts[5],
              value: parts[6]
            };
          });

          // Do this async. We don't need to wait
          models.cookieJar.update(renderedRequest.cookieJar, {cookies});

          if (cookies.length) {
            timeline.push({
              name: 'TEXT',
              value: `Updated cookie jar with ${cookies.length} cookies`
            });
          }
        }

        // Handle the body
        const encoding = 'base64';
        const bodyBuffer = Buffer.concat(dataBuffers, dataBuffersLength);
        const body = bodyBuffer.toString(encoding);

        // Return the response data
        respond({
          headers,
          encoding,
          body,
          contentType,
          statusCode,
          statusMessage,
          elapsedTime: curl.getInfo(Curl.info.TOTAL_TIME) * 1000,
          bytesRead: curl.getInfo(Curl.info.SIZE_DOWNLOAD),
          url: curl.getInfo(Curl.info.EFFECTIVE_URL)
        });

        // Close the request
        this.close();
      });

      curl.on('error', function (err, code) {
        let error = err + '';
        let statusMessage = 'Error';

        if (code === Curl.code.CURLE_ABORTED_BY_CALLBACK) {
          error = 'Request aborted';
          statusMessage = 'Abort';
        }

        respond({statusMessage, error});
      });

      curl.perform();
    } catch (err) {
      handleError(err);
    }
  });
}

export async function send (requestId, environmentId) {
  // First, lets wait for all debounces to finish
  await util.delay(DEBOUNCE_MILLIS * 2);

  const request = await models.request.getById(requestId);
  const settings = await models.settings.getOrCreate();

  // This may throw
  const renderedRequest = await getRenderedRequest(request, environmentId);

  // Get the workspace for the request
  const ancestors = await db.withAncestors(request);
  const workspace = ancestors.find(doc => doc.type === models.workspace.type);

  // Render succeeded so we're good to go!
  return _actuallySend(renderedRequest, workspace, settings);
}

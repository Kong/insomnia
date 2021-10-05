import { EventEmitter } from 'events';
import fs from 'fs';
// Note: we cannot import these from `node-libcurl` like normal because they come from the native library and it's not possible to load it while testing because it was built to run with Electron.
// That applies to these Enum type imports, but also applies to the members of the class below.
import { CurlAuth } from 'node-libcurl/dist/enum/CurlAuth';
import { CurlCode } from 'node-libcurl/dist/enum/CurlCode';
import { CurlFeature } from 'node-libcurl/dist/enum/CurlFeature';
import { CurlHttpVersion } from 'node-libcurl/dist/enum/CurlHttpVersion';
import { CurlInfoDebug } from 'node-libcurl/dist/enum/CurlInfoDebug';
import { CurlNetrc } from 'node-libcurl/dist/enum/CurlNetrc';

class Curl extends EventEmitter {
  _options = {};
  _meta = {};
  _features = {};

  static info = {
    COOKIELIST: 'COOKIELIST',
    EFFECTIVE_URL: 'EFFECTIVE_URL',
    SIZE_DOWNLOAD: 'SIZE_DOWNLOAD',
    TOTAL_TIME: 'TOTAL_TIME',
  };

  static option = {
    ACCEPT_ENCODING: 'ACCEPT_ENCODING',
    CAINFO: 'CAINFO',
    COOKIEFILE: 'COOKIEFILE',
    COOKIELIST: 'COOKIELIST',
    CUSTOMREQUEST: 'CUSTOMREQUEST',
    DEBUGFUNCTION: 'DEBUGFUNCTION',
    FOLLOWLOCATION: 'FOLLOWLOCATION',
    HTTPAUTH: 'HTTPAUTH',
    HTTPGET: 'HTTPGET',
    HTTPHEADER: 'HTTPHEADER',
    HTTPPOST: 'HTTPPOST',
    HTTP_VERSION: 'HTTP_VERSION',
    INFILESIZE_LARGE: 'INFILESIZE_LARGE',
    KEYPASSWD: 'KEYPASSWD',
    MAXREDIRS: 'MAXREDIRS',
    NETRC: 'NETRC',
    NOBODY: 'NOBODY',
    NOPROGRESS: 'NOPROGRESS',
    NOPROXY: 'NOPROXY',
    PASSWORD: 'PASSWORD',
    POST: 'POST',
    POSTFIELDS: 'POSTFIELDS',
    PROXY: 'PROXY',
    PROXYAUTH: 'PROXYAUTH',
    READDATA: 'READDATA',
    READFUNCTION: 'READFUNCTION',
    SSLCERT: 'SSLCERT',
    SSLCERTTYPE: 'SSLCERTTYPE',
    SSLKEY: 'SSLKEY',
    SSL_VERIFYHOST: 'SSL_VERIFYHOST',
    SSL_VERIFYPEER: 'SSL_VERIFYPEER',
    TIMEOUT_MS: 'TIMEOUT_MS',
    UNIX_SOCKET_PATH: 'UNIX_SOCKET_PATH',
    UPLOAD: 'UPLOAD',
    URL: 'URL',
    USERAGENT: 'USERAGENT',
    USERNAME: 'USERNAME',
    VERBOSE: 'VERBOSE',
    WRITEFUNCTION: 'WRITEFUNCTION',
    XFERINFOFUNCTION: 'XFERINFOFUNCTION',
  };

  static getVersion() {
    return 'libcurl/7.54.0 LibreSSL/2.0.20 zlib/1.2.11 nghttp2/1.24.0';
  }

  enable(name) {
    this._features[name] = true;
  }

  setOpt(name, value) {
    if (!name) {
      throw new Error(`Invalid option ${name} ${value}`);
    }

    if (name === Curl.option.CAINFO) {
      // Just ignore this because it's platform-specific
      return;
    }

    if (name === Curl.option.READFUNCTION) {
      let body = '';

      // Only limiting this to prevent infinite loops
      for (let i = 0; i < 1000; i++) {
        const buffer = Buffer.alloc(23);
        const bytes = value(buffer);

        if (bytes === 0) {
          break;
        }

        body += buffer.slice(0, bytes);
      }

      this._meta[`${name}_VALUE`] = body;
    }

    if (name === Curl.option.COOKIELIST) {
      // This can be set multiple times
      this._options[name] = this._options[name] || [];

      this._options[name].push(value);
    } else if (name === Curl.option.READDATA) {
      const { size } = fs.fstatSync(value);
      const buffer = Buffer.alloc(size);
      fs.readSync(value, buffer, 0, size, 0);
      this._options[name] = buffer.toString();
    } else {
      this._options[name] = value;
    }
  }

  getInfo(name) {
    switch (name) {
      case Curl.info.COOKIELIST:
        return [`#HttpOnly_.insomnia.rest\tTRUE\t/url/path\tTRUE\t${Date.now() / 1000}\tfoo\tbar`];

      case Curl.info.EFFECTIVE_URL:
        return this._options[Curl.option.URL];

      case Curl.info.TOTAL_TIME:
        return 700;

      case Curl.info.SIZE_DOWNLOAD:
        return 800;

      default:
        throw new Error(`Invalid info ${name}`);
    }
  }

  perform() {
    process.nextTick(() => {
      const data = Buffer.from(
        JSON.stringify({
          options: this._options,
          meta: this._meta,
          features: this._features,
        }),
      );
      this.emit('data', data);

      // @ts-expect-error -- TSCONVERSION
      this._options.WRITEFUNCTION(data);

      process.nextTick(() => {
        this.emit(
          'end',
          'NOT_USED',
          'NOT_USED',
          [
            'HTTP/1.1 200 OK',
            `Content-Length: ${data.length}`,
            'Content-Type: application/json',
            '',
          ].join('\n'),
        );
      });
    });
  }

  close() {}
}

/**
 * This is just to make it easier to test
 * node-libcurl Enum exports (CurlAuth, CurlCode, etc) are TypeScript enums, which are converted to an object with format:
 * ```ts
 * const myEnum = {
 *   EnumKey: 0,
 *   0: EnumKey,
 * }
 * ```
 * We only want the named members (non-number ones)
 */
const getTsEnumOnlyWithNamedMembers = enumObj => {
  let obj = {};

  for (const member in enumObj) {
    if (typeof enumObj[member] === 'number') {
      obj = { ...obj, [member]: member };
    }
  }

  return obj;
};

// WARNING: changing this to `export default` will break the mock and be incredibly hard to debug. Ask me how I know.
module.exports = {
  Curl,
  CurlAuth: getTsEnumOnlyWithNamedMembers(CurlAuth),
  CurlCode: getTsEnumOnlyWithNamedMembers(CurlCode),
  CurlInfoDebug: getTsEnumOnlyWithNamedMembers(CurlInfoDebug),
  CurlFeature: getTsEnumOnlyWithNamedMembers(CurlFeature),
  CurlNetrc: getTsEnumOnlyWithNamedMembers(CurlNetrc),
  CurlHttpVersion: getTsEnumOnlyWithNamedMembers(CurlHttpVersion),
};

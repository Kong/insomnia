import { EventEmitter } from 'events';
import fs from 'fs';

class Curl extends EventEmitter {
  constructor() {
    super();
    this._options = {};
    this._meta = {};
    this._features = {};
  }

  static getVersion() {
    return 'libcurl/7.54.0 LibreSSL/2.0.20 zlib/1.2.11 nghttp2/1.24.0';
  }

  enable(name) {
    this._features[name] = true;
  }

  setUrl(url) {
    this.setOpt(Curl.option.URL, url);
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
          features: this._features
        })
      );

      this.emit('data', data);
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
            ''
          ].join('\n')
        );
      });
    });
  }

  close() {}
}

Curl.info = {
  COOKIELIST: 'COOKIELIST',
  EFFECTIVE_URL: 'EFFECTIVE_URL',
  SIZE_DOWNLOAD: 'SIZE_DOWNLOAD',
  TOTAL_TIME: 'TOTAL_TIME',
  debug: {
    DATA_IN: 'DATA_IN',
    DATA_OUT: 'DATA_OUT',
    SSL_DATA_IN: 'SSL_DATA_IN',
    SSL_DATA_OUT: 'SSL_DATA_OUT',
    TEXT: 'TEXT'
  }
};

Curl.auth = {
  ANY: 'ANY'
};

Curl.netrc = {
  IGNORED: 0,
  OPTIONAL: 1,
  REQUIRED: 2
};

Curl.feature = {
  NO_HEADER_PARSING: 'NO_HEADER_PARSING',
  NO_DATA_PARSING: 'NO_DATA_PARSING'
};

Curl.option = {
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
  XFERINFOFUNCTION: 'XFERINFOFUNCTION'
};

module.exports = {
  Curl: Curl
};

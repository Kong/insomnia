import {EventEmitter} from 'events';

class Curl extends EventEmitter {
  constructor () {
    super();
    this._options = {};
  }
  setOpt (name, value) {
    if (!name) {
      throw new Error(`Invalid option ${name} ${value}`);
    }

    if (name === Curl.option.CAINFO) {
      // Just ignore this because it's platform-specific
      return;
    }

    if (name === Curl.option.COOKIELIST) {
      // This can be set multiple times
      this._options[name] = this._options[name] || [];
      this._options[name].push(value);
    } else {
      this._options[name] = value;
    }
  }

  getInfo (name) {
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

  perform () {
    process.nextTick(() => {
      const data = Buffer.from(JSON.stringify({
        options: this._options
      }));

      this.emit('data', data);

      process.nextTick(() => {
        this.emit('end', 'NOT_USED', 'NOT_USED', [{
          'Content-Length': `${data.length}`,
          'Content-Type': 'application/json',
          result: {code: 200, reason: 'OK'}
        }]);
      });
    });
  }

  close () {
  }
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

Curl.option = {
  CAINFO: 'CAINFO',
  COOKIEFILE: 'COOKIEFILE',
  COOKIELIST: 'COOKIELIST',
  CUSTOMREQUEST: 'CUSTOMREQUEST',
  DEBUGFUNCTION: 'DEBUGFUNCTION',
  ACCEPT_ENCODING: 'ACCEPT_ENCODING',
  FOLLOWLOCATION: 'FOLLOWLOCATION',
  NOBODY: 'NOBODY',
  HTTPAUTH: 'HTTPAUTH',
  HTTPHEADER: 'HTTPHEADER',
  HTTPPOST: 'HTTPPOST',
  KEYPASSWD: 'KEYPASSWD',
  NOPROGRESS: 'NOPROGRESS',
  NOPROXY: 'NOPROXY',
  PASSWORD: 'PASSWORD',
  POSTFIELDS: 'POSTFIELDS',
  PROXY: 'PROXY',
  PROXYAUTH: 'PROXYAUTH',
  READDATA: 'READDATA',
  SSLCERT: 'SSLCERT',
  SSLCERTTYPE: 'SSLCERTTYPE',
  SSLKEY: 'SSLKEY',
  SSL_VERIFYHOST: 'SSL_VERIFYHOST',
  SSL_VERIFYPEER: 'SSL_VERIFYPEER',
  TIMEOUT_MS: 'TIMEOUT_MS',
  UPLOAD: 'UPLOAD',
  INFILESIZE: 'INFILESIZE',
  URL: 'URL',
  USERAGENT: 'USERAGENT',
  USERNAME: 'USERNAME',
  VERBOSE: 'VERBOSE',
  XFERINFOFUNCTION: 'XFERINFOFUNCTION'
};

module.exports = {
  Curl: Curl
};

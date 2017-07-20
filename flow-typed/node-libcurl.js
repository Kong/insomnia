declare class Curl {
  static option: {
    ACCEPT_ENCODING: string,
    CAINFO: string,
    COOKIE: string,
    COOKIEFILE: string,
    COOKIELIST: string,
    CUSTOMREQUEST: string,
    DEBUGFUNCTION: string,
    FOLLOWLOCATION: string,
    HTTPAUTH: string,
    HTTPHEADER: string,
    HTTPPOST: string,
    INFILESIZE: string,
    KEYPASSWD: string,
    NOBODY: string,
    NOPROGRESS: string,
    NOPROXY: string,
    PASSWORD: string,
    POSTFIELDS: string,
    PROXY: string,
    PROXYAUTH: string,
    READDATA: string,
    SSLCERT: string,
    SSLCERTTYPE: string,
    SSLKEY: string,
    SSL_VERIFYHOST: string,
    SSL_VERIFYPEER: string,
    TIMEOUT_MS: string,
    UNIX_SOCKET_PATH: string,
    UPLOAD: string,
    URL: string,
    USERAGENT: string,
    USERNAME: string,
    VERBOSE: string,
    XFERINFOFUNCTION: string,
  };

  static auth: {
    NTLM: string,
    DIGEST: string,
    BASIC: string,
    ANY: string
  };

  static code: {
    CURLE_ABORTED_BY_CALLBACK: string
  };

  static info: {
    EFFECTIVE_URL: string,
    SIZE_DOWNLOAD: string,
    TOTAL_TIME: string,
    debug: {
      SSL_DATA_IN: string,
      SSL_DATA_OUT: string,
    }
  };

  setOpt: (option: string, ...args: Array<any>) => void;
  getInfo: (option: string, ...args: Array<any>) => any;
  perform: () => void;
  close: () => void;
  on: (event: string, callback: Function) => void;
}

declare module 'node-libcurl' {
  declare module.exports: {
    Curl: typeof Curl
  }
}

declare class Curl {
  static option: {
    HTTPAUTH: string,
    PASSWORD: string,
    USERNAME: string,
    USERAGENT: string,
    POSTFIELDS: string,
    READDATA: string,
    UPLOAD: string,
    HTTPPOST: string,
    INFILESIZE: string,
    KEYPASSWD: string,
    HTTPHEADER: string,
    SSLCERTTYPE: string,
    SSLCERT: string,
    SSLKEY: string,
    PROXY: string,
    NOPROXY: string,
    PROXYAUTH: string,
    COOKIELIST: string,
    COOKIEFILE: string,
    CAINFO: string,
    SSL_VERIFYPEER: string,
    SSL_VERIFYHOST: string,
    UNIX_SOCKET_PATH: string,
    URL: string,
    XFERINFOFUNCTION: string,
    DEBUGFUNCTION: string,
    ACCEPT_ENCODING: string,
    NOPROGRESS: string,
    VERBOSE: string,
    TIMEOUT_MS: string,
    FOLLOWLOCATION: string,
    NOBODY: string,
    CUSTOMREQUEST: string,
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

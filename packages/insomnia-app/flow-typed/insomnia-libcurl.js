// @flow

declare class Curl {
  static getVersion: () => string;
  static feature: {
    NO_HEADER_PARSING: number,
    NO_DATA_PARSING: number
  };
  static option: {
    ACCEPT_ENCODING: number,
    CAINFO: number,
    COOKIE: number,
    COOKIEFILE: number,
    COOKIELIST: number,
    CUSTOMREQUEST: number,
    DEBUGFUNCTION: number,
    FOLLOWLOCATION: number,
    HTTPAUTH: number,
    HTTPGET: number,
    HTTPHEADER: number,
    HTTPPOST: number,
    INFILESIZE_LARGE: number,
    KEYPASSWD: number,
    MAXREDIRS: number,
    NETRC: number,
    NOBODY: number,
    NOPROGRESS: number,
    NOPROXY: number,
    PASSWORD: number,
    PATH_AS_IS: number,
    POST: number,
    POSTFIELDS: number,
    PROXY: number,
    PROXYAUTH: number,
    READDATA: number,
    READFUNCTION: number,
    SSLCERT: number,
    SSLCERTTYPE: number,
    SSLKEY: number,
    SSL_VERIFYHOST: number,
    SSL_VERIFYPEER: number,
    TIMEOUT_MS: number,
    UNIX_SOCKET_PATH: number,
    UPLOAD: number,
    URL: number,
    USERAGENT: number,
    USERNAME: number,
    VERBOSE: number,
    WRITEFUNCTION: number,
    XFERINFOFUNCTION: number
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

  static netrc: {
    IGNORED: number,
    OPTIONAL: number,
    REQUIRED: number
  };

  static info: {
    EFFECTIVE_URL: string,
    SIZE_DOWNLOAD: string,
    TOTAL_TIME: string,
    debug: {
      SSL_DATA_IN: string,
      SSL_DATA_OUT: string,
      DATA_OUT: string,
      DATA_IN: string,
      TEXT: string
    }
  };

  setOpt: (option: number, ...args: Array<any>) => void;
  enable: (option: number, ...args: Array<any>) => void;
  getInfo: (option: string, ...args: Array<any>) => any;
  perform: () => void;
  close: () => void;
  on: (event: string, callback: Function) => void;

  // ~~~~~~~~~~~ //
  // New Methods //
  // ~~~~~~~~~~~ //

  setUrl: (url: string) => void;
}

declare module 'insomnia-libcurl' {
  declare module.exports: {
    Curl: typeof Curl
  };
}

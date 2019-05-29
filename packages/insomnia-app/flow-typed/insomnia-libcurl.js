// @flow

declare class Curl {
  static getVersion: () => string;
  static feature: {|
    NoHeaderParsing: number,
    NoDataParsing: number,
  |};
  static option: {|
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
    XFERINFOFUNCTION: number,
  |};

  static auth: {|
    None: number,
    Bearer: number,
    Ntlm: number,
    Digest: number,
    Basic: number,
    Any: number,
  |};

  static code: {|
    CURLE_ABORTED_BY_CALLBACK: string,
  |};

  static netrc: {|
    Ignored: number,
    Optional: number,
    Required: number,
  |};

  static info: {|
    APPCONNECT_TIME: string,
    CONNECT_TIME: string,
    EFFECTIVE_URL: string,
    HEADER_SIZE: string,
    HTTP_CONNECTCODE: string,
    HTTP_VERSION: string,
    REDIRECT_COUNT: string,
    REDIRECT_TIME: string,
    REDIRECT_TIME: string,
    SIZE_DOWNLOAD: string,
    TOTAL_TIME: string,
    debug: {
      HeaderIn: string,
      HeaderOut: string,
      SslDataIn: string,
      SslDataOut: string,
      DataOut: string,
      DataIn: string,
      Text: string,
    },
  |};

  setOpt: (option: number, arg: any) => void;
  enable: (option: number) => void;
  getInfo: (option: string) => any;
  perform: () => void;
  close: () => void;
  on: (event: string, callback: Function) => void;
}

declare module 'insomnia-libcurl' {
  declare module.exports: {
    Curl: typeof Curl,
  };
}

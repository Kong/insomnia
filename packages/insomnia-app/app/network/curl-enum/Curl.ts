export class CurlEnums {
  static info = {
    COOKIELIST: 'COOKIELIST',
    EFFECTIVE_URL: 'EFFECTIVE_URL',
    SIZE_DOWNLOAD: 'SIZE_DOWNLOAD',
    TOTAL_TIME: 'TOTAL_TIME',
  };

  static option = {
    ACCEPT_ENCODING: 'ACCEPT_ENCODING',
    CAINFO: 'CAINFO',
    COOKIE: 'COOKIE',
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
  };
}

export enum CurlAuth {
  Basic = 1 << 0,
  Digest = 1 << 1,
  Ntlm = 1 << 3,
  DigestIe = 1 << 4,
  Any = ~DigestIe,
}

export enum CurlCode {
  CURLE_ABORTED_BY_CALLBACK = 42
}

export enum CurlHttpVersion {
  None,
  V1_0,
  V1_1,
  V2_0,
  V2Tls,
  V2PriorKnowledge,
  v3,
}

export enum CurlInfoDebug {
  Text,
  HeaderIn,
  HeaderOut,
  DataIn,
  DataOut,
  SslDataIn,
  SslDataOut,
}
export enum CurlNetrc {
  Ignored,
  Optional,
  Required,
}
export enum CurlFeature {
  NoDataParsing = 1 << 0,
  NoHeaderParsing = 1 << 1,
  Raw = NoDataParsing | NoHeaderParsing,
}

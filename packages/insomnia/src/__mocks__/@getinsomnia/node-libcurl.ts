// Mock for @getinsomnia/node-libcurl since we're replacing it with child_process curl

// Enum stubs for backward compatibility with existing code
export const CurlAuth = {
  Any: 'Any',
  Digest: 'Digest',
  Ntlm: 'Ntlm',
} as const;

export const CurlCode = {
  CURLE_OK: 0,
  CURLE_ABORTED_BY_CALLBACK: 42,
  CURLE_BAD_CONTENT_ENCODING: 61,
} as const;

export const CurlFeature = {
  Raw: 'Raw',
  StreamResponse: 'StreamResponse',
} as const;

export const CurlHttpVersion = {
  V1_0: 'V1_0',
  V1_1: 'V1_1',
  V2_0: 'V2_0',
  V2PriorKnowledge: 'V2PriorKnowledge',
  v3: 'v3',
} as const;

export const CurlInfoDebug = {
  Text: 'Text',
  DataIn: 'DataIn',
  DataOut: 'DataOut',
  SslDataIn: 'SslDataIn',
  SslDataOut: 'SslDataOut',
} as const;

export const CurlNetrc = {
  Required: 'Required',
} as const;

export const CurlSslOpt = {
  NativeCa: 'NativeCa',
} as const;

export const CurlProxy = {
  Http: 'Http',
  Https: 'Https',
  Socks4: 'Socks4',
  Socks5: 'Socks5',
} as const;

// Mock Curl class for existing code that still expects it
export class Curl {
  static info = {
    COOKIELIST: 'COOKIELIST',
    EFFECTIVE_URL: 'EFFECTIVE_URL',
    SIZE_DOWNLOAD: 'SIZE_DOWNLOAD',
    TOTAL_TIME: 'TOTAL_TIME',
    HTTP_CONNECTCODE: 'HTTP_CONNECTCODE',
  };

  static option = {
    URL: 'URL',
    HTTPHEADER: 'HTTPHEADER',
    CUSTOMREQUEST: 'CUSTOMREQUEST',
    POSTFIELDS: 'POSTFIELDS',
    DEBUGFUNCTION: 'DEBUGFUNCTION',
    ACCEPT_ENCODING: 'ACCEPT_ENCODING',
    SSL_OPTIONS: 'SSL_OPTIONS',
    PROXY: 'PROXY',
    PROXYTYPE: 'PROXYTYPE',
    TIMEOUT_MS: 'TIMEOUT_MS',
    FOLLOWLOCATION: 'FOLLOWLOCATION',
  };

  isOpen = false;

  constructor() {
    // Mock constructor
  }

  setOpt(_name: any, _value: any) {
    // Mock method - accepts any arguments
  }

  getInfo() {
    // Mock method
    return '';
  }

  enable() {
    // Mock method
  }

  on() {
    // Mock method
  }

  close() {
    this.isOpen = false;
  }

  perform() {
    // Mock method
  }
}

export type HeaderInfo = {
  result?: {
    code: number;
    reason: string;
    version: string;
  };
  [key: string]: any;
};

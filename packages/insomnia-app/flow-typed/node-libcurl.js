// @flow

declare class Curl {
  constructor(config: Object): Curl;
  enable(number): void;
  perform(): void;
  close(): void;
  setOpt(number, any): void;
  on(string, Function): void;
  getInfo(number): any;
  static getVersion(): string;
  static option: {
    [string]: number,
  };
  static info: {
    SIZE_DOWNLOAD: number,
    TOTAL_TIME: number,
    EFFECTIVE_URL: number,
  };
}

declare module 'node-libcurl' {
  declare module .exports: {
    Curl: typeof Curl;
    CurlAuth: {|
      Any: number,
      Basic: number,
      Digest: number,
      None: number,
      Ntlm: number,
    |};
    CurlCode: {|
      CURLE_ABORTED_BY_CALLBACK: number,
    |};
    CurlInfoDebug: {|
      Text: number,
      HeaderIn: number,
      HeaderOut: number,
      DataIn: number,
      DataOut: number,
      SslDataIn: number,
      SslDataOut: number,
    |};
    CurlFeature: {|
      Raw: number,
    |};
    CurlNetrc: {|
      Ignored: number,
      Optional: number,
      Required: number,
    |};
  }
}

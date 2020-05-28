// @flow

declare class Curl {
  constructor(config: Object): Curl;
  option: {
    [string]: number,
  }
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

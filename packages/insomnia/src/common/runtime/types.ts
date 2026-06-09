import type { AESMessage, Cookie, RequestHeader } from 'insomnia-data';

import type { RequestContext } from '../../../../insomnia-scripting-environment/src/objects';
import type { CurlRequestOptions, CurlRequestOutput, ResponsePatch } from '../../main/network/libcurl-promise';
import type { RenderedRequest, RenderInputType } from '../../templating/types';

interface CurlRequestErrorOutput {
  statusMessage: string;
  error: string;
}

export interface NetworkRuntime {
  getTimelinePath: (responseId: string) => Promise<string>;
  appendToTimelineOnError: (timelinePath: string, data: string) => Promise<void>;
  appendTimelineLines: (timelinePath: string, logs: string[]) => Promise<void>;
  getAuthHeader: (request: RenderedRequest, url: string) => Promise<RequestHeader | undefined>;
  executeCurlRequest: (options: CurlRequestOptions) => Promise<CurlRequestOutput | CurlRequestErrorOutput>;
  extractCookies: (options: {
    setCookieStrings: string[];
    currentUrl: string;
    cookieJar: { cookies: Cookie[] };
    settingStoreCookies: boolean;
  }) => Promise<{ cookies: Cookie[]; rejectedCookies: string[]; totalSetCookies: number }>;
  runScript: (options: { script: string; context: RequestContext }) => Promise<RequestContext | { error: string }>;
  applyRequestHooks: (
    renderedRequest: RenderedRequest,
    renderedContext: Record<string, any>,
  ) => Promise<RenderedRequest>;
  applyResponseHooks: (
    response: ResponsePatch,
    renderedRequest: RenderedRequest,
    renderedContext: Record<string, any>,
  ) => Promise<ResponsePatch>;
}

export interface CryptoRuntime {
  decryptAES: (symmetricKey: string | JsonWebKey, encryptedResult: AESMessage) => Promise<string>;
  encryptSecretValue: (rawValue: string, symmetricKey: JsonWebKey) => Promise<string>;
  decryptSecretValue: (encryptedValue: string, symmetricKey: JsonWebKey) => Promise<string>;
}

export interface TemplatingRuntime {
  renderTemplate: (input: RenderInputType) => Promise<string | null>;
}

export interface SecretStorageRuntime {
  setSecret: (key: string, secret: string) => Promise<void>;
  getSecret: (key: string) => Promise<string | null>;
  deleteSecret: (key: string) => Promise<void>;
  encryptString: (raw: string) => Promise<string>;
  decryptString: (cipherText: string) => Promise<string>;
}

export interface WebSocketRuntime {
  open: (options: any) => void;
  close: (options: { requestId: string }) => void;
  closeAll: () => void;
  readyState: {
    getCurrent: (options: { requestId: string }) => Promise<boolean>;
  };
  event: {
    findMany: (options: any) => Promise<any[]>;
    send: (options: any) => void;
  };
}

export interface SocketIORuntime {
  open: (options: any) => void;
  close: (options: { requestId: string }) => void;
  closeAll: () => void;
  readyState: {
    getCurrent: (options: { requestId: string }) => Promise<boolean>;
  };
  event: {
    findMany: (options: any) => Promise<any[]>;
    send: (options: any) => void;
    on: (options: any) => void;
    off: (options: any) => void;
  };
}

export interface GrpcRuntime {
  start: (options: any) => void;
  sendMessage: (options: any) => void;
  commit: (requestId: string) => void;
  cancel: (requestId: string) => void;
  loadMethods: (protoFileId: string) => Promise<any[]>;
  loadMethodsFromReflection: (options: any) => Promise<any[]>;
  closeAll: () => void;
  writeProtoFile: (protoFileId: string) => Promise<any>;
  validateProtoFile: (filePath: string) => Promise<void>;
}

export interface CookiesRuntime {
  fromJSON: (cookie: any) => Promise<any>;
  parse: (cookie: string) => Promise<any>;
  toString: (cookie: any) => Promise<string>;
  getCookiesForUrl: (args: { cookies: Cookie[]; url: string }) => Promise<Cookie[]>;
  addSetCookies: (args: {
    setCookieStrings: string[];
    currentUrl: string;
    cookieJar: { cookies: Cookie[] };
  }) => Promise<{ cookies: Cookie[]; rejectedCookies: string[] }>;
  getResponseCookiesFromHeaders: (headers: any) => Promise<any[]>;
}

export interface RuntimeCapabilities {
  network: NetworkRuntime;
  crypto: CryptoRuntime;
  templating: TemplatingRuntime;
  secretStorage: SecretStorageRuntime;
  webSocket: WebSocketRuntime;
  socketIO: SocketIORuntime;
  grpc: GrpcRuntime;
  cookies: CookiesRuntime;
}

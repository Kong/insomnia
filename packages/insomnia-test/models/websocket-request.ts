import type {
  RequestAuthentication,
  RequestHeader,
  RequestParameter,
  WebSocketRequest as AppWebSocketRequest,
} from "insomnia-data";

import type { ContentType } from "../enums/content-type";

export interface WebSocketRequestBody {
  contentType: ContentType;
  content: string;
}

export interface WebSocketRequestInit extends Pick<
  AppWebSocketRequest,
  "name" | "url"
> {
  body?: WebSocketRequestBody;
  params?: RequestParameter[];
  headers?: RequestHeader[];
  authentication?: RequestAuthentication;
  id?: string;
}

export class WebSocketRequest implements WebSocketRequestInit {
  name: string;
  url: string;
  body?: WebSocketRequestBody;
  params?: RequestParameter[];
  headers?: RequestHeader[];
  authentication?: RequestAuthentication;
  id?: string;

  constructor(init: WebSocketRequestInit) {
    this.name = init.name;
    this.url = init.url;
    this.body = init.body;
    this.params = init.params;
    this.headers = init.headers;
    this.authentication = init.authentication;
    this.id = init.id;
  }
}

export type { RequestHeader, RequestParameter };

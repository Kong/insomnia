import type { HttpMethod } from "@package/enums/http-method";
import type {
  AuthTypeOAuth1,
  AuthTypeOAuth2,
  Request as AppRequest,
  RequestBody as AppRequestBody,
  RequestBodyParameter,
  RequestHeader,
  RequestParameter,
} from "insomnia-data";

import type { RequestAuthentication as BaseRequestAuthentication } from "./authentication";

/** Base auth types plus OAuth 1.0, which only the HTTP Auth tab offers. */
export type RequestAuthentication = BaseRequestAuthentication | AuthTypeOAuth1;

export type HttpRequestBody = Pick<
  AppRequestBody,
  "mimeType" | "text" | "fileName" | "params"
>;

export interface HttpRequestInit extends Pick<
  AppRequest,
  "name" | "url" | "preRequestScript" | "afterResponseScript"
> {
  method: HttpMethod;
  body?: HttpRequestBody;
  params?: RequestParameter[];
  headers?: RequestHeader[];
  authentication?: RequestAuthentication;
  id?: string;
}

export class HttpRequest implements HttpRequestInit {
  name: string;
  url: string;
  method: HttpMethod;
  body?: HttpRequestBody;
  params?: RequestParameter[];
  headers?: RequestHeader[];
  authentication?: RequestAuthentication;
  preRequestScript?: string;
  afterResponseScript?: string;
  id?: string;

  constructor(init: HttpRequestInit) {
    this.name = init.name;
    this.url = init.url;
    this.method = init.method;
    this.body = init.body;
    this.params = init.params;
    this.headers = init.headers;
    this.authentication = init.authentication;
    this.preRequestScript = init.preRequestScript;
    this.afterResponseScript = init.afterResponseScript;
    this.id = init.id;
  }
}

export type {
  AuthTypeOAuth1,
  AuthTypeOAuth2,
  RequestBodyParameter,
  RequestHeader,
  RequestParameter,
};

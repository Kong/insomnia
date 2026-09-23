import type {
  AuthTypeOAuth1,
  AuthTypeOAuth2,
  Request as AppRequest,
  RequestAuthentication,
  RequestBody as AppRequestBody,
  RequestBodyParameter,
  RequestHeader,
  RequestParameter,
} from "../../insomnia-data/src/models/request";
import { HttpMethod } from "../enums/http-method";

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
  RequestAuthentication,
  RequestBodyParameter,
  RequestHeader,
  RequestParameter,
};

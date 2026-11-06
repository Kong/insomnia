import { HttpMethod } from "@package/enums/http-method";
import type {
  Request as AppRequest,
  RequestHeader,
  RequestParameter,
} from "insomnia-data";

import type { RequestAuthentication } from "./authentication";
import type { HttpRequestBody } from "./http-request";

export interface EventStreamRequestInit extends Pick<
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

export class EventStreamRequest implements EventStreamRequestInit {
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

  constructor(init: EventStreamRequestInit) {
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

export { HttpMethod as EventStreamMethod };
export type { HttpRequestBody as EventStreamRequestBody };
export type { RequestHeader, RequestParameter };

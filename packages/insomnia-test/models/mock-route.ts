import type { RequestHeader } from "insomnia-data";

import type { HttpMethod } from "../enums/http-method";
import type { MockBodyType } from "../enums/mock-body-type";

export interface MockRoute {
  id?: string;
  /** Must begin with a `/`. */
  path: string;
  /** Defaults to GET (the create dialog's own default). */
  method?: HttpMethod;
  statusCode?: number;
  statusText?: string;
  bodyType?: MockBodyType;
  body?: string;
  headers?: RequestHeader[];
}

export interface MockRouteHistoryEntry {
  method: string;
  url: string;
}

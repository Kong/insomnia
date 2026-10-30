import type { MockRoute as AppMockRoute } from "insomnia-data";

import type { HttpMethod } from "../enums/http-method";
import type { MockBodyType } from "../enums/mock-body-type";

export interface MockRoute extends Partial<
  Pick<AppMockRoute, "statusCode" | "statusText" | "body" | "headers">
> {
  id?: string;
  /** Must begin with a `/`. */
  path: string;
  /** Defaults to GET (the create dialog's own default). */
  method?: HttpMethod;
  bodyType?: MockBodyType;
}

export interface MockRouteHistoryEntry {
  method: string;
  url: string;
}

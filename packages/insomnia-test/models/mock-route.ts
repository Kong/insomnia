import type { HttpMethod } from "@package/enums/http-method";
import type { MockBodyType } from "@package/enums/mock-body-type";
import type { MockRoute as AppMockRoute } from "insomnia-data";

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

import type { McpRequest } from "insomnia-data";

import type { RequestAuthentication } from "./authentication";

export class McpClient implements Pick<McpRequest, "name" | "url"> {
  id?: string;

  constructor(
    readonly name: string,
    readonly url = "",
    readonly authentication?: RequestAuthentication,
  ) {}
}

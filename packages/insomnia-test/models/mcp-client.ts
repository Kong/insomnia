import type { McpRequest, RequestAuthentication } from "insomnia-data";

export class McpClient implements Pick<McpRequest, "name" | "url"> {
  id?: string;

  constructor(
    readonly name: string,
    readonly url = "",
    readonly authentication?: RequestAuthentication,
  ) {}
}

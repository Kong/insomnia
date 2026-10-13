import type { RequestAuthentication } from "insomnia-data";

export class McpClient {
  id?: string;

  constructor(
    readonly name: string,
    readonly url = "",
    readonly authentication?: RequestAuthentication,
  ) {}
}

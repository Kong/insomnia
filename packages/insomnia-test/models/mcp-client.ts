export class McpClient {
  id?: string;

  constructor(
    readonly name: string,
    readonly url = "",
  ) {}
}

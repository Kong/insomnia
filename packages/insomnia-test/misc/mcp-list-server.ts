import { MCP_LIST_SERVER } from './constants';

export type McpListReply = { result: unknown } | { error: { code: number; message: string } };

/** A reply for every request, or one per `params.cursor` (`""` is the first page). */
export type McpListScript = McpListReply | { pages: Record<string, McpListReply> };

export type McpListMethod = 'tools/list' | 'resources/list' | 'resources/templates/list' | 'prompts/list';

export type McpListConfig = Partial<Record<McpListMethod, McpListScript>> & {
  /**
   * Makes the `tools/list` reply stream a server-initiated `roots/list`
   * request right after the result, reusing the `tools/list` request's
   * JSON-RPC id (the two directions have independent id spaces, so this is legal).
   */
  serverRequestReusingToolsListId?: boolean;
};

/**
 * Gives a test its own scriptable endpoint on `misc/mcp-server.js` and
 * scripts what its list requests answer. List methods left out of `config`
 * answer with a valid empty list. Call again with the same `key` to switch
 * the behavior (e.g. between two Refresh clicks).
 */
export async function scriptMcpListServer(key: string, config: McpListConfig): Promise<string> {
  const url = `${MCP_LIST_SERVER}/${key}`;
  const response = await fetch(`${url}/config`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!response.ok) {
    throw new Error(`Scripting ${url} failed with HTTP ${response.status}`);
  }
  return url;
}

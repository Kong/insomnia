import { expect } from "@playwright/test";
import { BaseFlow } from "./base.flow";
import { McpClient } from "../models/mcp-client";
import { Project } from "../models/project";
import { Response } from "../models/response";

export class McpClientFlow extends BaseFlow {
  /**
   * Opens the given MCP Client node, selects `tool`, fills in its arguments,
   * and invokes it. Runs `callback` under a `toPass` retry loop (useful for
   * triggering/awaiting side effects the tool call depends on) before
   * reading the resulting response.
   * @param client - The MCP Client whose tool to call
   * @param tool - The name of the tool to select and call
   * @param args - Argument name/value pairs to fill in before calling the tool
   * @param callback - Invoked repeatedly until it passes, before reading the response
   * @param timeout - The maximum time, in milliseconds, to retry `callback`
   * @returns The response produced by the tool call
   */
  async callTool(
    client: McpClient,
    tool: string,
    args: Record<string, string>,
    callback: () => Promise<void> | void = () => {},
    timeout: number = 5000,
  ): Promise<Response> {
    const workspace = this.pageManager.workspacePage;
    const mcpClientPage = this.pageManager.mcpClientPage;
    const responsePage = this.pageManager.responsePage;

    const node = await workspace.findItemNode(client);
    await workspace.clickNode(node!);
    await mcpClientPage.navigate();

    await mcpClientPage.clickTool(tool);
    for (const [name, value] of Object.entries(args)) {
      await mcpClientPage.setToolArgument(name, value);
    }
    await mcpClientPage.callTool();

    await expect(async () => {
      await callback();
    }).toPass({ timeout });

    await responsePage.navigate();
    const data = await responsePage.get();
    return data;
  }

  /**
   * Opens the given MCP Client node and clicks its connect action.
   * @param client - The MCP Client to connect
   */
  async connect(client: McpClient): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const mcpClientPage = this.pageManager.mcpClientPage;

    const node = await workspace.findItemNode(client);
    await workspace.clickNode(node!);
    await mcpClientPage.navigate();
    await mcpClientPage.connect();
  }

  /**
   * Creates an MCP Client node under `parent` (delegating the tree creation
   * to `workspaceFlow.create`), then opens it and sets its URL.
   * @param parent - The project to create the MCP Client under
   * @param client - The MCP Client to create, including its URL
   * @returns The created MCP Client, with `id` populated
   */
  async create(parent: Project, client: McpClient): Promise<McpClient> {
    await this.flowManager.workspaceFlow.create(parent, client);

    const workspace = this.pageManager.workspacePage;
    const mcpClientPage = this.pageManager.mcpClientPage;

    const node = await workspace.findItemNode(client);
    await workspace.clickNode(node!);
    await mcpClientPage.navigate();
    await mcpClientPage.setUrl(client.url);

    return this.assertCreated(await this.get(client.name), client.name);
  }

  /**
   * Finds the MCP Client node matching `item` in the workspace tree, opens
   * it, and reads back its configured URL.
   * @param item - The MCP Client name, or an object with name and optional id to match
   * @returns The matching McpClient with `id` and `url` populated, or undefined if not found
   */
  async get(
    item: string | { name: string; id?: string },
  ): Promise<McpClient | undefined> {
    const identity = typeof item === "string" ? { name: item } : item;
    const workspace = this.pageManager.workspacePage;
    const mcpClientPage = this.pageManager.mcpClientPage;

    const node = await workspace.findItemNode(identity);
    if (!node) return undefined;

    await workspace.clickNode(node);
    await mcpClientPage.navigate();

    const url = await mcpClientPage.getUrl();
    const mcpClient = new McpClient(identity.name, url);
    mcpClient.id = node._id;
    return mcpClient;
  }

  /**
   * Opens the given MCP Client node and lists the names of its available tools.
   * @param client - The MCP Client to inspect
   * @returns The names of the tools exposed by the client
   */
  async getTools(client: McpClient): Promise<string[]> {
    const workspace = this.pageManager.workspacePage;
    const mcpClientPage = this.pageManager.mcpClientPage;

    const node = await workspace.findItemNode(client);
    await workspace.clickNode(node!);
    await mcpClientPage.navigate();
    return mcpClientPage.getTools();
  }
}

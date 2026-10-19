import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT } from "../misc/constants";
import { McpClient } from "../models/mcp-client";
import type { Project } from "../models/project";
import type { ResponseView } from "../models/response";
import type { OAuth2Tokens } from "../pages/auth-tab.page";
import type { McpCapabilityError, McpCapabilityType } from "../pages/mcp-client.page";
import type { PageManager } from "../pages/page-manager";
import { BaseFlow } from "./base.flow";
import type { FlowContext } from "./flow-context";
import type { WorkspaceFlow } from "./workspace.flow";

export class McpClientFlow extends BaseFlow {
  /**
   * @param flowManager - The owning FlowManager
   * @param pageManager - The shared PageManager
   * @param workspaceFlow - Used to create the workspace an MCP Client is added to
   */
  constructor(
    flowManager: FlowContext,
    pageManager: PageManager,
    private readonly workspaceFlow: WorkspaceFlow,
  ) {
    super(flowManager, pageManager);
  }

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
   * @returns The response view produced by the tool call
   */
  async callTool(
    client: McpClient,
    tool: string,
    args: Record<string, string>,
    callback: () => Promise<void> | void = () => {},
    timeout = DEFAULT_TIMEOUT,
  ): Promise<ResponseView> {
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
   * Opens the given MCP Client node and clicks its disconnect action,
   * waiting for the connection to close.
   * @param client - The MCP Client to disconnect
   */
  async disconnect(client: McpClient): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const mcpClientPage = this.pageManager.mcpClientPage;

    const node = await workspace.findItemNode(client);
    await workspace.clickNode(node!);
    await mcpClientPage.navigate();
    await mcpClientPage.disconnect();
  }

  /**
   * Opens `client`, clicks its Auth tab's token-fetch button and reads the
   * resulting tokens back.
   * @param client - The MCP Client whose OAuth 2.0 tokens to fetch
   * @returns The refresh, identity and access tokens now stored
   */
  async fetchOAuth2Tokens(client: McpClient): Promise<OAuth2Tokens> {
    const workspace = this.pageManager.workspacePage;
    const mcpClientPage = this.pageManager.mcpClientPage;

    const node = await workspace.findItemNode(client);
    await workspace.clickNode(node!);
    await mcpClientPage.navigate();

    await mcpClientPage.auth.fetchOAuth2Tokens();
    return mcpClientPage.auth.getOAuth2Tokens();
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
    await this.workspaceFlow.create(parent, client);

    const workspace = this.pageManager.workspacePage;
    const mcpClientPage = this.pageManager.mcpClientPage;

    const node = await workspace.findItemNode(client);
    await workspace.clickNode(node!);
    await mcpClientPage.navigate();
    await mcpClientPage.setUrl(client.url);
    // The tree node is the MCP workspace; the URL lives on its McpRequest child.
    const requestId = await this.waitForChildDocId(
      "insomnia.McpRequest.db",
      node!._id,
    );
    await this.waitForUrlPersisted(
      "insomnia.McpRequest.db",
      mcpClientPage,
      requestId,
      client.url,
    );
    if (client.authentication) {
      await this.applyAuthentication(mcpClientPage.auth, client.authentication);
    }

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

  /**
   * Opens the given MCP Client node and reads the error panel of one of its
   * sidebar capability items, waiting for it to appear.
   * @param client - The MCP Client to inspect
   * @param type - Which capability item (Tools / Resources / Prompts) to read
   * @returns The panel's title and per-entry bullets
   */
  async getListError(
    client: McpClient,
    type: McpCapabilityType,
  ): Promise<McpCapabilityError> {
    await this.open(client);
    return this.pageManager.mcpClientPage.getCapabilityError(type);
  }

  /**
   * Opens the given MCP Client node and collapses or expands one of its
   * sidebar capability items.
   * @param client - The MCP Client to operate on
   * @param type - Which capability item to toggle
   */
  async toggleCapability(client: McpClient, type: McpCapabilityType): Promise<void> {
    await this.open(client);
    await this.pageManager.mcpClientPage.toggleCapability(type);
  }

  /**
   * Opens the given MCP Client node and re-runs one capability item's list
   * request via its actions menu, re-deriving its entries and error.
   * @param client - The MCP Client to operate on
   * @param type - Which capability item to refresh
   */
  async refresh(client: McpClient, type: McpCapabilityType): Promise<void> {
    await this.open(client);
    await this.pageManager.mcpClientPage.clickCapabilityAction(type, "Refresh");
  }

  /**
   * Opens the given MCP Client node and requests the next page of one capability
   * item's list via its actions menu (offered once the server returned a
   * `nextCursor`).
   * @param client - The MCP Client to operate on
   * @param type - Which capability item to load more of
   */
  async loadMore(client: McpClient, type: McpCapabilityType): Promise<void> {
    await this.open(client);
    await this.pageManager.mcpClientPage.clickCapabilityAction(type, "Load More");
  }

  /**
   * Opens the given MCP Client node and reads which list action one of its
   * capability items currently offers.
   * @param client - The MCP Client to inspect
   * @param type - Which capability item's actions menu to read
   * @returns `Refresh`, or `Load More` while a `nextCursor` is pending
   */
  async getListAction(client: McpClient, type: McpCapabilityType): Promise<string> {
    await this.open(client);
    return this.pageManager.mcpClientPage.getCapabilityActionName(type);
  }

  /**
   * Opens the given MCP Client node and filters its sidebar primitives by name.
   * @param client - The MCP Client to operate on
   * @param text - The filter text to enter
   */
  async filterCapabilities(client: McpClient, text: string): Promise<void> {
    await this.open(client);
    await this.pageManager.mcpClientPage.setCapabilityFilter(text);
  }

  private async open(client: McpClient): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.findItemNode(client);
    await workspace.clickNode(node!);
    await this.pageManager.mcpClientPage.navigate();
  }
}

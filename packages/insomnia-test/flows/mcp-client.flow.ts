import { expect } from "@playwright/test";

import { type McpCapabilityType, McpListAction } from "../enums/mcp-capability";
import { DEFAULT_TIMEOUT } from "../misc/constants";
import { step } from "../misc/step";
import { McpClient } from "../models/mcp-client";
import type { Project } from "../models/project";
import type { ResponseView } from "../models/response";
import type { OAuth2Tokens } from "../pages/auth-tab.page";
import type { McpCapabilityError } from "../pages/mcp-client.page";
import type { PageManager } from "../pages/page-manager";
import { BaseFlow } from "./base.flow";
import type { FlowContext } from "./flow-context";
import type { WorkspaceFlow } from "./workspace.flow";

export class McpClientFlow extends BaseFlow {
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
   */
  @step()
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

    const node = await workspace.requireItemNode(client);
    await workspace.clickNode(node);
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
   */
  @step()
  async disconnect(client: McpClient): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const mcpClientPage = this.pageManager.mcpClientPage;

    const node = await workspace.requireItemNode(client);
    await workspace.clickNode(node);
    await mcpClientPage.navigate();
    await mcpClientPage.disconnect();
  }

  /**
   * Opens `client`, clicks its Auth tab's token-fetch button and reads the
   * resulting tokens back.
   */
  @step()
  async fetchOAuth2Tokens(client: McpClient): Promise<OAuth2Tokens> {
    const workspace = this.pageManager.workspacePage;
    const mcpClientPage = this.pageManager.mcpClientPage;

    const node = await workspace.requireItemNode(client);
    await workspace.clickNode(node);
    await mcpClientPage.navigate();

    await mcpClientPage.auth.fetchOAuth2Tokens();
    return mcpClientPage.auth.getOAuth2Tokens();
  }

  /**
   * Opens the given MCP Client node and clicks its connect action.
   */
  @step()
  async connect(
    client: McpClient,
    options?: { expectConnected?: boolean },
  ): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const mcpClientPage = this.pageManager.mcpClientPage;

    const node = await workspace.requireItemNode(client);
    await workspace.clickNode(node);
    await mcpClientPage.navigate();
    await mcpClientPage.connect(options);
  }

  /**
   * Creates an MCP Client node under `parent` (delegating the tree creation
   * to `workspaceFlow.createMcpClient`), then opens it and sets its URL.
   */
  @step()
  async create(parent: Project, client: McpClient): Promise<McpClient> {
    await this.workspaceFlow.createMcpClient(parent, client);

    const workspace = this.pageManager.workspacePage;
    const mcpClientPage = this.pageManager.mcpClientPage;

    const node = await workspace.requireItemNode(client);
    await workspace.clickNode(node);
    await mcpClientPage.navigate();
    await mcpClientPage.setUrl(client.url);
    // The tree node is the MCP workspace; the URL lives on its McpRequest child.
    const requestId = await this.waitForChildDocId(
      "insomnia.McpRequest.db",
      node._id,
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
   */
  @step()
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
   */
  @step()
  async getTools(client: McpClient): Promise<string[]> {
    const workspace = this.pageManager.workspacePage;
    const mcpClientPage = this.pageManager.mcpClientPage;

    const node = await workspace.requireItemNode(client);
    await workspace.clickNode(node);
    await mcpClientPage.navigate();
    return mcpClientPage.getTools();
  }

  /**
   * Opens the given MCP Client node and reads the error panel of one of its
   * sidebar capability items, waiting for it to appear.
   */
  @step()
  async getListError(client: McpClient, type: McpCapabilityType): Promise<McpCapabilityError> {
    await this.open(client);
    return this.pageManager.mcpClientPage.getCapabilityError(type);
  }

  /**
   * Opens the given MCP Client node and collapses or expands one of its
   * sidebar capability items.
   */
  @step()
  async toggleCapability(client: McpClient, type: McpCapabilityType): Promise<void> {
    await this.open(client);
    await this.pageManager.mcpClientPage.toggleCapability(type);
  }

  /**
   * Opens the given MCP Client node and re-runs one capability item's list
   * request via its actions menu, re-deriving its entries and error.
   */
  @step()
  async refresh(client: McpClient, type: McpCapabilityType): Promise<void> {
    await this.open(client);
    await this.pageManager.mcpClientPage.clickCapabilityAction(type, McpListAction.Reload);
  }

  /**
   * Opens the given MCP Client node and requests the next page of one capability
   * item's list via its actions menu (offered once the server returned a
   * `nextCursor`).
   */
  @step()
  async loadMore(client: McpClient, type: McpCapabilityType): Promise<void> {
    await this.open(client);
    await this.pageManager.mcpClientPage.clickCapabilityAction(type, McpListAction.LoadMore);
  }

  /**
   * Opens the given MCP Client node and reads which list action one of its
   * capability items currently offers.
   */
  @step()
  async getListAction(client: McpClient, type: McpCapabilityType): Promise<McpListAction> {
    await this.open(client);
    return this.pageManager.mcpClientPage.getCapabilityActionName(type);
  }

  /**
   * Opens the given MCP Client node and filters its sidebar primitives by name.
   */
  @step()
  async filterCapabilities(client: McpClient, text: string): Promise<void> {
    await this.open(client);
    await this.pageManager.mcpClientPage.setCapabilityFilter(text);
  }

  private async open(client: McpClient): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.requireItemNode(client);
    await workspace.clickNode(node);
    await this.pageManager.mcpClientPage.navigate();
  }
}

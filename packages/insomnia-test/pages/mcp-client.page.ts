import { expect } from "@playwright/test";
import { RequestPage } from "./request.page";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";

export class McpClientPage extends RequestPage {
  private readonly CALL_TOOL_BUTTON = `${this.TABPANEL} button:has-text("Call Tool")`;
  private readonly FILTER_INPUT =
    'input[aria-label="Server Capability filter"]';
  private readonly SIDEBAR = "#sidebar-mcp-gridlist";
  private readonly TOOL_ROW = `${this.SIDEBAR} [role="row"][data-key^="tools_"]`;
  protected readonly urlBarId = "mcp-url-bar";

  /**
   * Switches to the "params" tab and clicks "Call Tool" to invoke the
   * currently selected tool with its configured arguments.
   */
  async callTool(): Promise<void> {
    await this.switchTab("params");
    await this.page.locator(this.CALL_TOOL_BUTTON).click();
  }

  /**
   * Selects a tool from the sidebar by clicking the row whose `aria-label`
   * matches the given name.
   * @param name - The name of the tool to select
   */
  async clickTool(name: string): Promise<void> {
    await this.page
      .locator(`${this.SIDEBAR} [role="row"][aria-label="${name}"]`)
      .click();
  }

  /**
   * Reads the names of all tools currently listed in the sidebar, as taken
   * from each tool row's `aria-label`.
   * @returns The list of tool names
   */
  async getTools(): Promise<string[]> {
    return this.page
      .locator(this.TOOL_ROW)
      .evaluateAll((rows) =>
        rows.map((row) => row.getAttribute("aria-label") ?? ""),
      );
  }

  /**
   * Confirms the MCP client request pane has loaded by waiting for the
   * server capability filter input to become visible.
   */
  async navigate(): Promise<void> {
    await expect(this.page.locator(this.FILTER_INPUT)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Sets the value of a tool argument input on the "params" tab. Arguments
   * are rendered as a JSON-schema form, so each field's input is located
   * by an id of `root_<name>`.
   * @param name - The argument's field name
   * @param value - The value to fill into the argument's input
   */
  async setToolArgument(name: string, value: string): Promise<void> {
    await this.switchTab("params");
    const input = this.page.locator(`${this.TABPANEL} #root_${name}`);
    await input.click();
    await input.fill(value);
  }
}

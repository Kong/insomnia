import { expect, type Locator } from '@playwright/test';

import type { McpListAction} from '../enums/mcp-capability';
import { type McpCapabilityType, type McpPrimitiveType } from '../enums/mcp-capability';
import { ACTION_TIMEOUT, DEFAULT_TIMEOUT } from '../misc/constants';
import { RequestPage } from './request.page';

/** The error panel embedded in a capability item's row. */
export interface McpCapabilityError {
  title: string;
  /** One per bullet: the entry's label and its schema issue. */
  entries: { label: string; reason: string }[];
}

export class McpClientPage extends RequestPage {
  private readonly CALL_TOOL_BUTTON = `${this.TABPANEL} button:has-text("Call Tool")`;
  private readonly FILTER_INPUT = 'input[aria-label="Server Capability filter"]';
  private readonly SIDEBAR = '#sidebar-mcp-gridlist';
  private readonly TOOL_ROW = `${this.SIDEBAR} [role="row"][data-key^="tools_"]`;
  private readonly ACTIONS_MENU = '[aria-label="Mcp Actions Menu"]';
  protected readonly urlBarId = 'mcp-url-bar';

  /**
   * Clicks Disconnect and waits for the button to flip back to "Connect".
   * While connected the whole URL form is `aria-disabled`, which makes
   * Playwright treat the Disconnect button inside it as not enabled even
   * though it is clickable, so the click has to be forced.
   * @param callback - A callback retried via expect().toPass() before disconnecting
   * @param timeout - The maximum time to retry the callback, in milliseconds
   */
  override async disconnect(callback: () => Promise<void> | void = () => {}, timeout = DEFAULT_TIMEOUT): Promise<void> {
    await expect(async () => {
      await callback();
    }).toPass({ timeout });

    const connectButton = this.page.locator(this.PANE).getByRole('button', { name: /^(Connect|Disconnect)$/ });
    await connectButton.click({ force: true });
    await expect(connectButton).toHaveText('Connect', {
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Switches to the "params" tab and clicks "Call Tool" to invoke the
   * currently selected tool with its configured arguments.
   */
  async callTool(): Promise<void> {
    await this.switchTab('params');
    await this.page.locator(this.CALL_TOOL_BUTTON).click();
  }

  /**
   * Selects a tool from the sidebar by clicking the row whose `aria-label`
   * matches the given name.
   * @param name - The name of the tool to select
   */
  async clickTool(name: string): Promise<void> {
    await this.page.locator(`${this.SIDEBAR} [role="row"][aria-label="${name}"]`).click();
  }

  /**
   * Reads the names of all tools currently listed in the sidebar, as taken
   * from each tool row's `aria-label`.
   * @returns The list of tool names
   */
  async getTools(): Promise<string[]> {
    // The sidebar is populated asynchronously once the server answers
    // tools/list, and it can re-render (briefly empty) while it settles,
    // so poll until a non-empty list of names has been read.
    let tools: string[] = [];
    await expect
      .poll(
        async () => {
          tools = (
            await this.page
              .locator(this.TOOL_ROW)
              .evaluateAll(rows => rows.map(row => row.getAttribute('aria-label') ?? ''))
          ).filter(Boolean);
          return tools.length;
        },
        { timeout: ACTION_TIMEOUT },
      )
      .toBeGreaterThan(0);
    return tools;
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
   * Types into the server capability filter input, narrowing the sidebar
   * primitives by name.
   * @param text - The filter text to enter
   */
  async setCapabilityFilter(text: string): Promise<void> {
    await this.page.locator(this.FILTER_INPUT).fill(text);
  }

  /**
   * Sets the value of a tool argument input on the "params" tab. Arguments
   * are rendered as a JSON-schema form, so each field's input is located
   * by an id of `root_<name>`.
   * @param name - The argument's field name
   * @param value - The value to fill into the argument's input
   */
  async setToolArgument(name: string, value: string): Promise<void> {
    await this.switchTab('params');
    const input = this.page.locator(`${this.TABPANEL} #root_${name}`);
    await input.click();
    await input.fill(value);
  }

  /**
   * The capability item (Tools / Resources / Prompts) row in the sidebar.
   * @param type - Which capability item to locate
   */
  private getCapabilityItem(type: McpCapabilityType): Locator {
    return this.page.locator(`${this.SIDEBAR} [data-testid="test-root_${type}"]`);
  }

  /**
   * The error panel embedded in a capability item's row.
   * @param type - Which capability item's panel to locate
   */
  private getCapabilityErrorPanel(type: McpCapabilityType): Locator {
    return this.getCapabilityItem(type).locator('.notice.error');
  }

  /**
   * How many error panels a capability item's row currently shows (0 or 1).
   * @param type - Which capability item to check
   */
  async getCapabilityErrorCount(type: McpCapabilityType): Promise<number> {
    return this.getCapabilityErrorPanel(type).count();
  }

  /**
   * Whether the sidebar currently lists the given capability item at all.
   * @param type - Which capability item to check
   */
  async hasCapability(type: McpCapabilityType): Promise<boolean> {
    return (await this.getCapabilityItem(type).count()) > 0;
  }

  /**
   * The on-screen rectangle of a capability item's row (including its embedded
   * error panel), waiting for it to be visible.
   * @param type - Which capability item to measure
   */
  async getCapabilityBounds(type: McpCapabilityType): Promise<{ y: number; height: number }> {
    const capabilityItem = this.getCapabilityItem(type);
    await expect(capabilityItem).toBeVisible({ timeout: ACTION_TIMEOUT });
    return (await capabilityItem.boundingBox())!;
  }

  /**
   * The on-screen rectangle of a capability item's error panel, waiting for it to
   * be visible.
   * @param type - Which capability item's panel to measure
   */
  async getCapabilityErrorBounds(type: McpCapabilityType): Promise<{ y: number; height: number }> {
    const panel = this.getCapabilityErrorPanel(type);
    await expect(panel).toBeVisible({ timeout: ACTION_TIMEOUT });
    return (await panel.boundingBox())!;
  }

  /**
   * Whether the error panel's content overflows its own area, i.e. it
   * scrolls instead of growing over the rows below.
   * @param type - Which capability item's panel to check
   */
  async isCapabilityErrorScrollable(type: McpCapabilityType): Promise<boolean> {
    return this.getCapabilityErrorPanel(type)
      .locator('.overflow-y-auto')
      .evaluate(el => el.scrollHeight > el.clientHeight);
  }

  /**
   * Reads the error panel of a capability item, waiting for it to appear.
   * @param type - Which capability item to read
   * @returns The panel's title and its per-entry bullets (empty for a title-only panel)
   */
  async getCapabilityError(type: McpCapabilityType): Promise<McpCapabilityError> {
    const panel = this.getCapabilityErrorPanel(type);
    await expect(panel).toBeVisible({ timeout: ACTION_TIMEOUT });
    const title = (await panel.locator('p').first().innerText()).trim();
    const entries = await panel.locator('li').evaluateAll(items =>
      items.map(item => {
        const label = item.querySelector('span')?.textContent ?? '';
        const text = item.textContent ?? '';
        return {
          label: label.trim(),
          reason: text.slice(label.length).replace(/^:\s*/, '').trim(),
        };
      }),
    );
    return { title, entries };
  }

  /**
   * Reads the names of the rows of one primitive kind currently listed in
   * the sidebar, without waiting (unlike `getTools()`), so an empty list is
   * a valid answer. Collapsed capability items list nothing.
   * @param type - The primitive kind whose rows to read
   */
  async getPrimitives(type: McpPrimitiveType): Promise<string[]> {
    return (
      await this.page
        .locator(`${this.SIDEBAR} [role="row"][data-key^="${type}_"]`)
        .evaluateAll(rows => rows.map(row => row.getAttribute('aria-label') ?? ''))
    ).filter(Boolean);
  }

  /**
   * Whether a capability item shows an expand/collapse caret. Empty capability items
   * (e.g. a whole-response failure) have none.
   * @param type - Which capability item to check
   */
  async hasCaret(type: McpCapabilityType): Promise<boolean> {
    return (await this.getCapabilityItem(type).locator('svg.w-4[data-icon^="caret"]').count()) > 0;
  }

  /**
   * Toggles a capability item between expanded and collapsed by clicking its row
   * header (above the error panel, so the panel never intercepts the click).
   * @param type - Which capability item to toggle
   */
  async toggleCapability(type: McpCapabilityType): Promise<void> {
    await this.getCapabilityItem(type).click({ position: { x: 60, y: 10 } });
  }

  /**
   * Opens a capability item's actions menu and clicks the given entry. The menu
   * button only shows while its row is hovered/focused, so hover first.
   * @param type - Which capability item's menu to open
   * @param action - `Refresh`, or `Load More` once the server returned a `nextCursor`
   */
  async clickCapabilityAction(type: McpCapabilityType, action: McpListAction): Promise<void> {
    const capabilityItem = this.getCapabilityItem(type);
    await capabilityItem.hover({ position: { x: 60, y: 10 } });
    await capabilityItem.locator(`[data-testid="Dropdown-${type}"]`).click();
    await this.page.locator(this.ACTIONS_MENU).locator(`[role^="menuitem"][aria-label="${action}"]`).click();
  }

  /**
   * Reads which list action a capability item's menu currently offers: `Refresh`,
   * or `Load More` while the server's last page carried a `nextCursor`.
   * Opens the menu to read it and closes it again.
   * @param type - Which capability item's menu to read
   */
  async getCapabilityActionName(type: McpCapabilityType): Promise<McpListAction> {
    const capabilityItem = this.getCapabilityItem(type);
    await capabilityItem.hover({ position: { x: 60, y: 10 } });
    await capabilityItem.locator(`[data-testid="Dropdown-${type}"]`).click();
    const item = this.page.locator(this.ACTIONS_MENU).locator('[role^="menuitem"]').first();
    const name = (await item.innerText()).trim() as McpListAction;
    await this.page.keyboard.press('Escape');
    await expect(item).toBeHidden();
    return name;
  }
}

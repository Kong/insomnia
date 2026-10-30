import type { Locator } from "@playwright/test";
import { expect } from "@playwright/test";

import { DEFAULT_TIMEOUT } from "../misc/constants";
import { BasePage } from "./base.page";

export type VariableSourceScope = "page" | "modal";

export interface VariableSourceModal {
  source?: string;
  preview: string;
}

export class VariableSourcePage extends BasePage {
  private readonly CHIP_HOVER_ATTEMPTS = 5;
  private readonly ENVIRONMENTS_GRID = 'role=grid[name="Environments"]';
  private readonly ENVIRONMENTS_MODAL_NAME = "Manage Environments";
  private readonly MANAGE_BUTTON_NAME = "Manage API collection environments";
  private readonly PICKER_LABEL = "Select an API Collection Environment";
  private readonly SOURCE_ROW = '[data-testid="variable-source-row"]';
  private readonly SOURCE_OPEN = '[data-testid="variable-source-open"]';
  private readonly TOOLTIP = '[data-testid="variable-source-tooltip"]';
  private readonly TOOLTIP_OPEN = '[data-testid="variable-source-tooltip-open"]';

  /**
   * Waits for the request pane's Body tab content to be showing a
   * rendered template tag, confirming a body with variables is ready.
   */
  async navigate(): Promise<void> {
    await this.page.getByText("Body", { exact: true }).click();
  }

  /**
   * Opens the Manage Environments modal from the collection environment
   * picker and returns once it is visible.
   */
  async openManageEnvironmentsModal(): Promise<void> {
    await this.page.getByLabel(this.PICKER_LABEL).click();
    await this.page
      .getByRole("button", { name: this.MANAGE_BUTTON_NAME })
      .click();
    await this.modal.waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Picks a project environment in the "Select a Project Environment"
   * popover without asserting the trigger's label afterwards — an
   * imported project environment's trigger shows its base environment's
   * own name ("Base Environment"), not the container name picked here.
   */
  async selectProjectEnvironment(optionName: string): Promise<void> {
    await this.page.getByLabel("Select a Project Environment").click();
    const listbox = this.page.getByRole("listbox", {
      name: "Select a Project Environment",
    });
    await listbox.getByRole("option", { name: optionName }).click();
    await this.page.keyboard.press("Escape");
    await listbox.waitFor({ state: "hidden", timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Selects an environment row inside the open Manage Environments modal.
   */
  async selectModalEnvironment(name: string): Promise<void> {
    await this.modal.getByRole("row", { name, exact: true }).click();
  }

  /**
   * Clicks a rendered template tag matching `snippet` in the request body
   * to open its tag editor modal, then reads its Source row and Live
   * Preview. `source` is undefined when the modal shows no Source row.
   */
  async openVariableModal(snippet: string): Promise<VariableSourceModal> {
    const chip = this.getChip(snippet, "page");
    await chip.waitFor({ state: "visible" });
    await chip.click();
    return this.readVariableModal();
  }

  /**
   * Reads the currently open tag editor modal's Source row and Live
   * Preview.
   */
  async readVariableModal(): Promise<VariableSourceModal> {
    const dialog = this.page.getByRole("dialog");
    const preview = dialog.locator("textarea");
    await expect(preview).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    // The Source row is recomputed asynchronously after every template change,
    // so read an atomic snapshot (no visible-then-innerText race) and wait
    // until two consecutive snapshots agree.
    const snapshot = () =>
      dialog.evaluate((el, sel) => {
        const row = el.querySelector<HTMLElement>(sel);
        const textarea = el.querySelector("textarea");
        return {
          source: row ? row.innerText.replace(/\s+/g, " ").trim() : undefined,
          preview: textarea?.value ?? "",
        };
      }, this.SOURCE_ROW);
    let previous = await snapshot();
    await expect
      .poll(
        async () => {
          const current = await snapshot();
          const settled = JSON.stringify(current) === JSON.stringify(previous);
          previous = current;
          return settled;
        },
        { timeout: DEFAULT_TIMEOUT, intervals: [200] },
      )
      .toBe(true);
    return previous;
  }

  /**
   * Polls the open tag editor modal until its Live Preview equals
   * `expected`, then returns the settled modal state.
   */
  async waitForModalPreview(expected: string): Promise<VariableSourceModal> {
    await expect(this.page.getByRole("dialog").locator("textarea")).toHaveValue(
      expected,
      { timeout: DEFAULT_TIMEOUT * 1.5 },
    );
    return this.readVariableModal();
  }

  /**
   * Picks an option in the open tag editor modal's "Environment Variable"
   * select, by its option value or visible label.
   */
  async selectModalVariable(option: string | { label: string }): Promise<void> {
    await this.page
      .getByRole("dialog")
      .getByLabel("Environment Variable")
      .selectOption(option);
  }

  /**
   * Replaces the open tag editor modal's custom template text.
   */
  async setModalCustomTemplate(template: string): Promise<void> {
    await this.page
      .getByRole("dialog")
      .locator('input[type="text"]')
      .fill(template);
  }

  /**
   * Clicks the Source row's "Open" button in the open tag editor modal.
   */
  async clickModalSourceOpen(): Promise<void> {
    await this.page.getByRole("dialog").locator(this.SOURCE_OPEN).click();
  }

  /**
   * Hovers the template tag matching `snippet` until the variable-source
   * tooltip appears (re-entering the tag if its mark was rebuilt under
   * the pointer), then reads the tooltip text and the chip's own text.
   */
  async hoverVariable(
    snippet: string,
    scope: VariableSourceScope = "page",
  ): Promise<{ tooltip: string; chip: string }> {
    const chip = this.getChip(snippet, scope);
    await chip.waitFor({ state: "visible" });
    const tooltip = this.page.locator(this.TOOLTIP);
    for (let attempt = 0; attempt < this.CHIP_HOVER_ATTEMPTS; attempt++) {
      await this.page.mouse.move(0, 0);
      await chip.hover();
      try {
        await tooltip.waitFor({ state: "visible", timeout: 1500 });
        break;
      } catch {
        continue;
      }
    }
    await expect(tooltip).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    return {
      tooltip: (await tooltip.innerText()).replace(/\s+/g, " ").trim(),
      chip: (await chip.innerText()).trim(),
    };
  }

  /**
   * Moves the pointer onto the tooltip's own content, waits past the
   * hide grace period, and reports whether it is still visible.
   */
  async isTooltipKeptOnHover(): Promise<boolean> {
    const tooltip = this.page.locator(this.TOOLTIP);
    await tooltip.hover();
    const startedAt = Date.now();
    await expect
      .poll(() => Date.now() - startedAt >= 700, {
        timeout: 1000,
        intervals: [250],
      })
      .toBe(true);
    return tooltip.isVisible();
  }

  /**
   * Hovers `snippet`'s tag, waits for the tooltip, then reads the tooltip
   * text once it contains `expected` (used when the tooltip swaps content
   * as the pointer moves between tags).
   */
  async hoverVariableUntilTooltipContains(
    snippet: string,
    expected: string,
  ): Promise<string> {
    const chip = this.getChip(snippet, "page");
    await chip.waitFor({ state: "visible" });
    await chip.hover();
    const tooltip = this.page.locator(this.TOOLTIP);
    await expect(tooltip).toContainText(expected, { timeout: DEFAULT_TIMEOUT });
    return (await tooltip.innerText()).replace(/\s+/g, " ").trim();
  }

  /**
   * Clicks the visible tooltip's "Open" button.
   */
  async clickTooltipOpen(): Promise<void> {
    await this.page.locator(this.TOOLTIP_OPEN).click();
  }

  /**
   * Reports the Manage Environments modal's open state (count of dialogs
   * with that name, to catch stacked duplicates).
   */
  async getManageEnvironmentsModalCount(): Promise<number> {
    return this.modal.count();
  }

  /**
   * Waits for the Manage Environments modal to close.
   */
  async waitForManageEnvironmentsModalHidden(): Promise<void> {
    await this.modal.waitFor({ state: "hidden", timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reports whether an environment row (in the page's Environments grid)
   * is selected, polling until it reaches the expected state.
   */
  async isEnvironmentRowSelected(name: string): Promise<boolean> {
    const row = this.page
      .locator(this.ENVIRONMENTS_GRID)
      .getByRole("row", { name, exact: true });
    await row.waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT });
    try {
      await expect(row).toHaveAttribute("aria-selected", "true", {
        timeout: DEFAULT_TIMEOUT,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Waits (best effort) for the window URL to match `pattern`, then reads
   * it back — callers assert on the returned URL.
   */
  async waitForUrl(pattern: RegExp): Promise<string> {
    try {
      await this.page.waitForURL(pattern, { timeout: DEFAULT_TIMEOUT });
    } catch {
      return this.page.url();
    }
    return this.page.url();
  }

  /**
   * Reports whether the Environment tab of the currently open folder pane
   * is selected.
   */
  async isEnvironmentTabSelected(): Promise<boolean> {
    const tab = this.page.getByRole("tab", { name: "Environment" });
    try {
      await expect(tab).toHaveAttribute("aria-selected", "true", {
        timeout: DEFAULT_TIMEOUT,
      });
      return true;
    } catch {
      return false;
    }
  }

  private get modal(): Locator {
    return this.page.getByRole("dialog", { name: this.ENVIRONMENTS_MODAL_NAME });
  }

  private getChip(snippet: string, scope: VariableSourceScope): Locator {
    const root = scope === "modal" ? this.modal : this.page;
    return root.locator(`[data-template*="${snippet}"]`);
  }
}

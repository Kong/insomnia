import { expect, Locator } from "@playwright/test";
import { BasePage } from "./base.page";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import {
  RunnerIterationResult,
  RunnerLiveStatus,
  RunnerRequestItem,
  RunnerResultFilter,
  RunnerResultsByFilter,
  RunnerTestResult,
  RunnerTestResultCount,
} from "../models/runner";

export type RunnerRequestTab = "request-order" | "advanced";

const RUNNER_RESULT_FILTERS: RunnerResultFilter[] = [
  "All",
  "Passed",
  "Failed",
  "Skipped",
];

export class RunnerPage extends BasePage {
  private readonly REQUEST_PANE = '[data-testid="request-pane"]';
  private readonly RESULT_PANE = "#pane-two";
  // Renamed from "Request Collection" — INS-3528.
  private readonly REQUEST_LIST = `[data-testid="request-pane"] [role="grid"][aria-label="Request API Collection"]`;
  private readonly ITERATIONS_INPUT = `${this.REQUEST_PANE} input[name="Iterations"]`;
  private readonly DELAY_INPUT = `${this.REQUEST_PANE} input[name="Delay"]`;
  private readonly UPLOAD_DATA_BUTTON = `${this.REQUEST_PANE} button:has-text("Upload Data")`;
  private readonly RUN_BUTTON = `${this.REQUEST_PANE} button:has-text("Run")`;
  private readonly KEEP_LOGS_CHECKBOX = `${this.REQUEST_PANE} input[name="enable-log"]`;
  private readonly BAIL_CHECKBOX = `${this.REQUEST_PANE} input[name="bail"]`;
  private readonly CANCEL_ALL_BUTTON = `${this.RESULT_PANE} button:has-text("Cancel all")`;

  /**
   * Waits for the "Run" button to become visible and the request-order
   * list to populate, confirming the Runner pane has fully loaded — the
   * list renders asynchronously slightly after the button itself appears.
   */
  async navigate(): Promise<void> {
    await expect(this.page.locator(this.RUN_BUTTON)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
    await expect(
      this.page.locator(`${this.REQUEST_LIST} [role="row"]`).first(),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Switches between the "Request Order" and "Advanced" tabs on the left
   * (request configuration) pane.
   * @param tab - The tab to switch to
   */
  async switchRequestTab(tab: RunnerRequestTab): Promise<void> {
    await this.page
      .locator(`${this.REQUEST_PANE} [role="tab"][data-key="${tab}"]`)
      .click();
  }

  /**
   * Checks/unchecks "Keep logs after run" on the "Advanced" tab, switching
   * to that tab first since its checkboxes only render while active.
   * @param enabled - Whether logs should be kept after the run completes
   */
  async setKeepLogs(enabled: boolean): Promise<void> {
    await this.switchRequestTab("advanced");
    await this.page.locator(this.KEEP_LOGS_CHECKBOX).setChecked(enabled);
  }

  /**
   * Checks/unchecks "Stop run if an error occurs" on the "Advanced" tab,
   * switching to that tab first since its checkboxes only render while
   * active.
   * @param enabled - Whether the run should bail on the first error
   */
  async setBail(enabled: boolean): Promise<void> {
    await this.switchRequestTab("advanced");
    await this.page.locator(this.BAIL_CHECKBOX).setChecked(enabled);
  }

  /**
   * Fills the "Iterations" input and verifies the value stuck.
   * @param count - The number of iterations to run
   */
  async setIterations(count: number): Promise<void> {
    const input = this.page.locator(this.ITERATIONS_INPUT);
    await input.fill(String(count));
    await expect(input).toHaveValue(String(count));
  }

  /**
   * Reads the current value of the "Iterations" input.
   * @returns The configured number of iterations
   */
  async getIterations(): Promise<number> {
    return Number(
      await this.page.locator(this.ITERATIONS_INPUT).inputValue(),
    );
  }

  /**
   * Fills the "Delay (ms)" input and verifies the value stuck.
   * @param ms - The delay between requests, in milliseconds
   */
  async setDelay(ms: number): Promise<void> {
    const input = this.page.locator(this.DELAY_INPUT);
    await input.fill(String(ms));
    await expect(input).toHaveValue(String(ms));
  }

  /**
   * Clicks "Upload Data" to open the upload modal, sets `filePath` on its
   * (JSON/CSV) file input, waits for the parsed preview to render, then
   * confirms via the modal's own "Upload" button. Uploading data with N
   * rows overrides the Iterations input to N.
   * @param filePath - Absolute path to the .json/.csv data file to upload
   */
  async uploadData(filePath: string): Promise<void> {
    await this.page.locator(this.UPLOAD_DATA_BUTTON).click();
    const dialog = this.page.locator('[role="dialog"]');
    await dialog.locator('input[type="file"]').setInputFiles(filePath);
    const uploadButton = dialog.getByRole("button", {
      name: "Upload",
      exact: true,
    });
    await expect(uploadButton).toBeEnabled({ timeout: DEFAULT_TIMEOUT });
    await uploadButton.click();
    await expect(dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks the "Run" button to start the runner with the currently
   * selected requests.
   */
  async clickRun(): Promise<void> {
    await this.page.locator(this.RUN_BUTTON).click();
  }

  /**
   * Clicks "Cancel all" on the live progress pane while a run is in
   * flight, canceling the rest of the run.
   */
  async cancelRun(): Promise<void> {
    await this.page.locator(this.CANCEL_ALL_BUTTON).click();
  }

  /**
   * Clicks the "Skip" button on a specific request's live progress card,
   * available only while that item is still "pending" or "running".
   * @param name - The exact request name shown on the live progress card
   */
  async skipItem(name: string): Promise<void> {
    await this.page
      .locator(`${this.RESULT_PANE} [data-testid="runner-live-item-${name}"]`)
      .getByRole("button", { name: "Skip", exact: true })
      .first()
      .click();
  }

  /**
   * Reads the live progress pane's summary line (e.g. "Running 2 / 6
   * requests (1 skipped, 0 canceled)"), available only while a run is in
   * flight or was just canceled.
   * @returns The parsed live-run status, or undefined if the live progress
   * pane isn't currently shown
   */
  async getStatus(): Promise<RunnerLiveStatus | undefined> {
    const label = this.page
      .locator(`${this.RESULT_PANE} span`)
      .filter({ hasText: /^(Running|Finished) \d+ \/ \d+ requests/ })
      .first();
    if ((await label.count()) === 0) return undefined;
    const text = (await label.innerText()).trim();
    const match = text.match(
      /^(Running|Finished) (\d+) \/ (\d+) requests \((\d+) skipped, (\d+) canceled\)$/,
    );
    if (!match) return undefined;
    return {
      running: match[1] === "Running",
      finished: Number(match[2]),
      total: Number(match[3]),
      skipped: Number(match[4]),
      canceled: Number(match[5]),
    };
  }

  /**
   * Reads a single request's status badge (e.g. "SKIPPED", "CANCELED",
   * "RUNNING", "200 OK") off its live progress card. If the same request
   * name appears in more than one iteration, reads the earliest (first in
   * DOM order) occurrence — the same one `skipItem()` targets.
   * @param name - The exact request name shown on the live progress card
   * @returns The badge's trimmed text, or undefined if no such card exists
   */
  async getItemStatus(name: string): Promise<string | undefined> {
    const card = this.page
      .locator(`${this.RESULT_PANE} [data-testid="runner-live-item-${name}"]`)
      .first();
    if ((await card.count()) === 0) return undefined;
    return (
      await card.locator("div.text-center.font-semibold").first().innerText()
    ).trim();
  }

  /**
   * Reads the request-order list as currently rendered: each request's
   * name, HTTP method, and whether it's selected to run.
   * @returns The request-order list, top to bottom
   */
  async getRequestOrder(): Promise<RunnerRequestItem[]> {
    const rows = this.page.locator(`${this.REQUEST_LIST} [role="row"]`);
    const count = await rows.count();
    const items: RunnerRequestItem[] = [];
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      items.push({
        name: (await row.locator("span").last().innerText()).trim(),
        method: (
          await row.locator('span[class*="http-method-"]').innerText()
        ).trim(),
        selected: (await row.getAttribute("aria-selected")) === "true",
      });
    }
    return items;
  }

  /**
   * Reads the "passed / total" count badge shown on the "Results" tab.
   * @returns The passed and total test counts
   */
  async getTestResultCount(): Promise<RunnerTestResultCount> {
    const text = (
      await this.page.locator(`${this.RESULT_PANE} .test-result-count`)
        .innerText()
    ).trim();
    const [passed, total] = text.split("/").map((n) => Number(n.trim()));
    return { passed, total };
  }

  /**
   * Clicks one of the "All" / "Passed" / "Failed" / "Skipped" filter
   * buttons above the results list.
   * @param filter - The filter to apply
   */
  private async setResultFilter(filter: RunnerResultFilter): Promise<void> {
    await this.page
      .locator(this.RESULT_PANE)
      .getByRole("button", { name: filter, exact: true })
      .click();
  }

  /**
   * Reads every iteration block from the "Results" tab, each with its
   * per-request status, name, elapsed time, and byte size.
   * @returns The results grouped by iteration, in run order
   */
  async getIterationResults(): Promise<RunnerIterationResult[]> {
    const blocks = this.page.locator(
      `${this.RESULT_PANE} [data-testid^="runner-test-result-iteration-"]`,
    );
    const count = await blocks.count();
    const iterations: RunnerIterationResult[] = [];
    for (let i = 0; i < count; i++) {
      const block = blocks.nth(i);
      const label = (
        await block.locator(".font-bold.uppercase").innerText()
      ).trim();
      const rows = block.locator('[data-testid^="request-test-result-"]');
      const rowCount = await rows.count();
      const results: RunnerTestResult[] = [];
      for (let r = 0; r < rowCount; r++) {
        results.push(await this.parseResultRow(rows.nth(r)));
      }
      iterations.push({
        iteration: Number(label.replace(/\D+/g, "")),
        results,
      });
    }
    return iterations;
  }

  /**
   * Reads the "Results" tab once per filter (All/Passed/Failed/Skipped),
   * clicking each filter button in turn via `setResultFilter()` before
   * re-scraping with `getIterationResults()`. Leaves the "All" filter
   * active afterward.
   * @returns The iteration results scraped under each filter, keyed by filter name
   */
  async getIterationResultsByFilter(): Promise<RunnerResultsByFilter> {
    const results: RunnerResultsByFilter = new Map();
    for (const filter of RUNNER_RESULT_FILTERS) {
      await this.setResultFilter(filter);
      results.set(filter, await this.getIterationResults());
    }
    await this.setResultFilter("All");
    return results;
  }

  private async parseResultRow(row: Locator): Promise<RunnerTestResult> {
    const status = (
      await row.locator("div.text-center.font-semibold").first().innerText()
    ).trim();
    const detail = row.locator(".min-w-0.flex-1 > div");
    const name = (
      await detail.nth(0).locator("span").first().innerText()
    ).trim();
    const detailCount = await detail.count();
    const meta =
      detailCount > 1 ? (await detail.nth(1).innerText()).trim() : "";
    const match = meta.match(/^(\d+)ms - (\d+) bytes$/);
    return {
      name,
      status,
      durationMs: match ? Number(match[1]) : undefined,
      bytes: match ? Number(match[2]) : undefined,
    };
  }
}

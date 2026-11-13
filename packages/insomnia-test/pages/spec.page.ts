import { DropdownComponent } from "@package/components/dropdown.component";
import { ModalComponent } from "@package/components/modal.component";
import { SearchFieldComponent } from "@package/components/search-field.component";
import { TabBarComponent } from "@package/components/tab-bar.component";
import { TableComponent } from "@package/components/table.component";
import { TreeComponent } from "@package/components/tree.component";
import type { ContextMenuItem } from "@package/enums/context-menu-items";
import { HttpMethod } from "@package/enums/http-method";
import { LintSeverity } from "@package/enums/lint-severity";
import { ProjectType } from "@package/enums/project-types";
import { RulesetType } from "@package/enums/ruleset-type";
import type { SpecFormat } from "@package/enums/spec-format";
import { TreeNodeType } from "@package/enums/tree-node-types";
import { ACTION_TIMEOUT, DEFAULT_TIMEOUT } from "@package/misc/constants";
import { throwOnDialog } from "@package/misc/decorators";
import type { LintEntry, PathItem } from "@package/models/collection";
import { Info, License, Specification } from "@package/models/collection";
import { expect } from "@playwright/test";
import type { Locator } from "playwright-core";

import { BasePage } from "./base.page";

const METHOD_LABELS: Record<string, HttpMethod> = {
  GET: HttpMethod.Get,
  POST: HttpMethod.Post,
  PUT: HttpMethod.Put,
  PATCH: HttpMethod.Patch,
  DEL: HttpMethod.Delete,
  DELETE: HttpMethod.Delete,
  HEAD: HttpMethod.Head,
  OPTIONS: HttpMethod.Options,
};

/** One method badge in the spec outline: the method (from the badge's
 * test id, e.g. `QUERY`) and the label it shows (e.g. `QRY`). */
export interface OutlineMethodBadge {
  method: string;
  label: string;
}

/** One operation listed by the Swagger UI docs preview. */
export interface PreviewOperation {
  method: string;
  path: string;
}

/** One row of the outline's Webhooks section: the webhook name and the
 * label of each method badge on the row. */
export interface WebhookEntry {
  name: string;
  methods: string[];
}

export type OutlineSection =
  | "info"
  | "servers"
  | "paths"
  | "requestBodies"
  | "responses"
  | "parameters"
  | "headers"
  | "schemas"
  | "securitySchemes";

const OUTLINE_SECTIONS: Record<
  OutlineSection,
  { label: string; prefix: string }
> = {
  info: { label: "Info", prefix: "info." },
  servers: { label: "Servers", prefix: "servers." },
  paths: { label: "Paths", prefix: "paths." },
  requestBodies: {
    label: "Request bodies",
    prefix: "components.requestBodies.",
  },
  responses: { label: "Responses", prefix: "components.responses." },
  parameters: { label: "Parameters", prefix: "components.parameters." },
  headers: { label: "Headers", prefix: "components.headers." },
  schemas: { label: "Schemas", prefix: "components.schemas." },
  securitySchemes: { label: "Security", prefix: "components.securitySchemes." },
};

/** A single row read back from the "Tests passed/failed" result screen. */
export interface UnitTestResultRow {
  title: string;
  passed: boolean;
}

export class SpecPage extends BasePage {
  // Spec editor / lint panel / legacy unit tests — rendered on a
  // Collection's landing view once it carries an ApiSpec (the former
  // standalone Document workspace's UI lives in this same view).
  private readonly DEFAULT_RULESET_LABEL = "Default OAS Ruleset";
  private readonly FORMAT_BUTTON = 'button[aria-label="Spec format"]';
  private readonly GENERATE_BUTTON = 'button[aria-label="Generate"]';
  private readonly GENERATE_REQUESTS_ITEM =
    '[aria-label="Generate menu"] [role^="menuitem"][aria-label="Requests"]';
  private readonly LINT_ENTRY_ROW = "div[aria-expanded]";
  private readonly LINT_PANEL = '[data-testid="lint-panel"]';
  private readonly LINT_PANEL_TOGGLE = '[data-testid="lint-panel-toggle"]';
  private readonly NEW_TEST_BUTTON = 'button[aria-label="New test"]';
  private readonly NO_LINT_PROBLEMS = "No lint problems";
  private readonly PANE_ONE = '[data-panel-id="spec-pane-one"]';
  private readonly PANE_TWO = '[data-panel-id="pane-two"]';
  private readonly PREVIEW_OPERATION = "#swagger-ui .opblock";
  private readonly PREVIEW_TOGGLE = '[data-testid="preview-toggle"]';
  private readonly REMOVE_RULESET_BUTTON =
    'button[aria-label="Remove custom ruleset"]';
  private readonly RUN_ALL_TESTS_BUTTON = 'button[aria-label="Run all tests"]';
  private readonly SPEC_EDITOR = '[data-testid="CodeEditor"] .CodeMirror';
  private readonly TEST_RESULTS = '[aria-label="Test results"]';
  private readonly TEST_SUITES_LIST = '[aria-label="Test Suites"]';
  private readonly WEBHOOK_ROWS = '[aria-label="Webhooks"] [role="row"]';
  private readonly UNIT_TESTS_LIST = '[aria-label="Unit tests"]';
  private readonly UPLOAD_RULESET_BUTTON =
    'button[aria-label="Upload custom ruleset"]';
  private readonly VIEW_RULESET_BUTTON =
    'button[aria-label="View selected ruleset content"]';

  // --- Spec editor / lint panel / legacy unit tests (folded
  // into this page from the former standalone Document workspace) ---

  /**
   * Clicks "New test" inside the currently open suite and waits for a new
   * (default-named) test row to render.
   */
  async createTest(): Promise<void> {
    const rows = new TableComponent(
      this.page,
      this.page.locator(this.UNIT_TESTS_LIST),
    ).rows;
    const before = await rows.count();
    await this.page.locator(this.NEW_TEST_BUTTON).click();
    await expect(rows).toHaveCount(before + 1, { timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks "New test suite", which creates a default-named suite and
   * navigates straight into it.
   */
  async createTestSuite(): Promise<void> {
    const rows = new TableComponent(
      this.page,
      this.page.locator(this.TEST_SUITES_LIST),
    ).rows;
    const before = await rows.count();
    await this.page.getByRole("button", { name: "New test suite" }).click();
    await expect(rows).toHaveCount(before + 1, { timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Opens `suiteName`'s "Unit Test Actions" menu from the Test Suites list
   * and deletes it via the "Delete suite" confirm modal.
   */
  async deleteTestSuite(suiteName: string): Promise<void> {
    const row = new TableComponent(
      this.page,
      this.page.locator(this.TEST_SUITES_LIST),
    ).row(suiteName);
    const actions = row.getByLabel("Unit Test Actions");
    await actions.click();
    await new DropdownComponent(this.page, actions)
      .item("Delete suite")
      .click();

    const dialog = new ModalComponent(this.page).root;
    await dialog.getByRole("button", { name: "Delete" }).click();
    await expect(dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    await expect(row).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks the lint toggle to expand the lint panel if it isn't already
   * open (the toggle otherwise collapses an already-open panel, so this
   * checks first rather than clicking unconditionally), waiting for it to
   * attach. A no-op if the spec has no content yet (the entire toolbar,
   * including the toggle, only renders once a spec is present) or if there
   * are no lint problems at all (the toggle only renders once
   * `lintMessages.length > 0`).
   */
  async expandLintPanel(): Promise<void> {
    if ((await this.page.locator(this.FORMAT_BUTTON).count()) === 0) return;
    if (await this.page.getByText(this.NO_LINT_PROBLEMS).isVisible()) return;
    if (!(await this.page.locator(this.LINT_PANEL).isVisible())) {
      await this.page.locator(this.LINT_PANEL_TOGGLE).click();
    }
    await expect(this.page.locator(this.LINT_PANEL)).toBeAttached({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Reads the currently selected spec format from the format button's
   * label.
   */
  async getFormat(): Promise<SpecFormat> {
    const text = (
      await this.page.locator(this.FORMAT_BUTTON).innerText()
    ).trim();
    return text as SpecFormat;
  }

  /**
   * Reads every lint entry currently listed in the (already expanded) lint
   * panel, expanding each one in turn to also collect its `lineRefs` — this
   * leaves every entry expanded afterward, and costs one click per entry,
   * so prefer `getLintEntryCodes()` when only the rule ids are needed (e.g.
   * inside a poll).
   */
  async getLintEntries(): Promise<LintEntry[]> {
    const rows = this.page
      .locator(this.LINT_PANEL)
      .locator(this.LINT_ENTRY_ROW);
    const rowCount = await rows.count();
    const entries: LintEntry[] = [];

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const summary = await this.getLintRowSummary(row);
      if (!summary) continue;

      if ((await row.getAttribute("aria-expanded")) !== "true") {
        await row.getByRole("button").first().click({ timeout: 2_000 });
      }
      const lineRefs = await row.getByText(/^Ln \d+$/).allInnerTexts();
      entries.push({ ...summary, lineRefs });
    }

    return entries;
  }

  /**
   * Reads every rule id currently listed in the (already expanded) lint
   * panel, without expanding any entry.
   */
  async getLintEntryCodes(): Promise<string[]> {
    const rows = this.page
      .locator(this.LINT_PANEL)
      .locator(this.LINT_ENTRY_ROW);
    const rowCount = await rows.count();
    const codes: string[] = [];

    for (let i = 0; i < rowCount; i++) {
      const summary = await this.getLintRowSummary(rows.nth(i));
      if (summary) codes.push(summary.code);
    }

    return codes;
  }

  /**
   * Reads the lint toggle's error/warning summary.
   */
  async getLintSummary(): Promise<
    { errors: number; warnings: number } | "none"
  > {
    if (
      (await this.page.locator(this.FORMAT_BUTTON).count()) === 0 ||
      (await this.page.getByText(this.NO_LINT_PROBLEMS).isVisible())
    ) {
      return "none";
    }
    const text = await this.page.locator(this.LINT_PANEL_TOGGLE).innerText();
    const match = text.match(/(\d+)\s+errors?,\s*(\d+)\s+warnings?/);
    return {
      errors: Number(match?.[1] ?? 0),
      warnings: Number(match?.[2] ?? 0),
    };
  }

  /**
   * Reads the "OpenAPI x.y.z" version label shown in the toolbar's left
   * corner. Empty for a Swagger 2.0 spec (which has no `openapi` field) or
   * a collection with no spec content yet — neither renders this label at
   * all.
   */
  async getOpenApiVersion(): Promise<string> {
    // The span is always rendered once the spec has content, but stays
    // empty until the parsed spec's `openapi` field is known, so wait for
    // text rather than for the element.
    const label = this.page.getByTestId("spec-openapi-version");
    try {
      await expect(label).toHaveText(/OpenAPI \d/, {
        timeout: DEFAULT_TIMEOUT,
      });
    } catch {
      return "";
    }
    return (await label.innerText()).trim();
  }

  /**
   * Reads which ruleset is currently active, based on whether the "View
   * selected ruleset content" button (custom) or the default OAS ruleset
   * label is showing.
   */
  async getRulesetType(): Promise<RulesetType> {
    const isCustom = await this.page
      .locator(this.VIEW_RULESET_BUTTON)
      .isVisible();
    return isCustom ? RulesetType.Custom : RulesetType.Default;
  }

  /**
   * Reads the name of the currently selected row in the (single-select)
   * Test Suites sidebar — the suite whose Tests tab is presently open.
   */
  async getSelectedTestSuiteName(): Promise<string> {
    return (
      await this.page
        .locator(this.TEST_SUITES_LIST)
        .getByRole("row", { selected: true })
        .innerText()
    ).trim();
  }

  /**
   * Reads the spec's own "Info"/"Paths" outline panel (the collapsible
   * section list next to the spec editor, driven by `[role="option"]`
   * rows under `data-key="info.*"` and `[role="row"]` rows under
   * `data-key="paths.*"`) instead of parsing the raw spec text. Sections
   * render collapsed by default. Note: this panel doesn't expose
   * `host`/`basePath`/`schemes` (no "Servers" section renders for a
   * Swagger 2.0 doc) or the license's `url` (only the license name is
   * shown as text) — those simply aren't recoverable from this UI.
   */
  async getSpecification(): Promise<Specification | undefined> {
    const infoButton = this.page.getByRole("button", { name: "Info" });
    if ((await infoButton.count()) === 0) return undefined;

    await this.expandOutlineSection(infoButton, '[data-key^="info."]');
    const infoData = await this.page
      .locator('[role="option"][data-key^="info."]')
      .evaluateAll((els) =>
        Object.fromEntries(
          els.map((el) => {
            const key = el.dataset.key!.replace("info.", "");
            const text = el.textContent ?? "";
            return [key, text.slice(text.indexOf(":") + 1).trim()];
          }),
        ),
      );

    const pathsButton = this.page.getByRole("button", { name: "Paths" });
    const hasPaths = (await pathsButton.count()) > 0;
    if (hasPaths) {
      await this.expandOutlineSection(pathsButton, '[data-key^="paths."]');
    }
    const pathRows = hasPaths
      ? await this.page
          .locator('[role="row"][data-key^="paths."]')
          .evaluateAll((rows) =>
            rows.map((row) => ({
              path: row.dataset.key!.replace(/^paths\./, ""),
              methods: Array.from(
                row.querySelectorAll<HTMLElement>(
                  '[data-testid^="spec-outline-method-"]',
                ),
              ).map((button) =>
                button.dataset.testid!.replace("spec-outline-method-", ""),
              ),
            })),
          )
      : [];

    const info = new Info(
      infoData.title,
      infoData.version,
      infoData.description,
      infoData.license ? new License(infoData.license) : undefined,
    );

    const paths: Record<string, PathItem> = {};
    for (const { path, methods } of pathRows) {
      const pathItem: PathItem = paths[path] ?? {};
      for (const method of methods) {
        const httpMethod = METHOD_LABELS[method.toUpperCase()];
        if (!httpMethod) continue;
        pathItem[httpMethod.toLowerCase() as Lowercase<HttpMethod>] = {};
      }
      paths[path] = pathItem;
    }

    return new Specification(info, paths);
  }

  /**
   * Reads every test title and pass/fail state from the "Tests
   * passed/failed" result screen shown after `runAllTests()`.
   */
  async getTestResultRows(): Promise<UnitTestResultRow[]> {
    const rows = this.page
      .locator(this.TEST_RESULTS)
      .getByTestId("unit-test-result-row");
    return rows.evaluateAll((els) =>
      els.map((el) => ({
        title:
          el
            .querySelector('[data-testid="unit-test-result-name"]')
            ?.textContent?.trim() ?? "",
        passed: !el.querySelector('[data-testid="unit-test-result-detail"]'),
      })),
    );
  }

  /**
   * Reads the "Tests passed N/M" or "Tests failed N/M" summary heading
   * shown after `runAllTests()`.
   */
  async getTestResultSummary(): Promise<string> {
    return (
      await this.page
        .getByRole("heading", { name: /Tests (passed|failed)/ })
        .innerText()
    ).trim();
  }

  /**
   * Reads every suite name currently listed in the Test Suites sidebar.
   */
  async getTestSuiteNames(): Promise<string[]> {
    // Re-opening the Tests tab re-renders the list; wait for it to settle
    // so a read taken mid-render doesn't return a stale or partial list.
    return this.waitForStableValue(() =>
      new TableComponent(
        this.page,
        this.page.locator(this.TEST_SUITES_LIST),
      ).rows.allInnerTexts(),
    );
  }

  /**
   * Reads every test name currently listed under the open suite.
   */
  async getUnitTestNames(): Promise<string[]> {
    return new TableComponent(
      this.page,
      this.page.locator(this.UNIT_TESTS_LIST),
    ).rows.allInnerTexts();
  }

  /**
   * Checks whether the docs-preview pane (`.pane-two`) is currently
   * visible.
   */
  async isPreviewOpen(): Promise<boolean> {
    return this.page.locator(this.PANE_TWO).isVisible();
  }

  /**
   * Opens the docs-preview pane if it is closed, waits for Swagger UI to
   * render, and reads every listed operation (its method label and path)
   * in display order.
   */
  async getPreviewOperations(): Promise<PreviewOperation[]> {
    if (!(await this.isPreviewOpen())) {
      await this.togglePreview();
    }
    const blocks = this.page.locator(this.PREVIEW_OPERATION);
    await expect(blocks.first()).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    return blocks.evaluateAll((elements) =>
      elements.map((element) => ({
        method: (
          element.querySelector(".opblock-summary-method")?.textContent ?? ""
        ).trim(),
        path: (
          element.querySelector(".opblock-summary-path")?.textContent ?? ""
        ).trim(),
      })),
    );
  }

  /**
   * Waits for the spec's CodeMirror editor to become visible, confirming
   * the collection's spec/landing view is ready for interaction.
   */
  async navigate(workspaceId?: string): Promise<void> {
    await expect(this.page.locator(this.SPEC_EDITOR)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
    // The CodeMirror editor above can render before the Outline panel's
    // "Info" section has finished mounting, so a getSpecification() read
    // taken right after this resolves can still see an empty Outline and
    // report no specification at all. A collection with no spec authored
    // at all never gets an Outline/Info section though — it shows the
    // empty-state landing heading instead. Either can also flicker through
    // the other's state for a moment while the pane is still settling.
    const info = this.page.getByRole("button", { name: "Info", exact: true });
    const emptyState = this.page.getByRole("heading", {
      name: /Enter your OpenAPI specification/,
    });
    if (workspaceId) {
      // Which of the two to wait for is known from the persisted spec, so
      // a flicker through the other one can't be mistaken for "settled".
      const hasSpec = (
        await this.readPersistedDocs("insomnia.ApiSpec.db")
      ).some((doc) => doc.parentId === workspaceId && doc.contents?.trim());
      await expect(hasSpec ? info : emptyState).toBeVisible({
        timeout: DEFAULT_TIMEOUT,
      });
      return;
    }
    // Without a workspace id there's no way to tell which is expected, so
    // require the same outcome on consecutive reads before trusting it.
    await this.waitForStableValue(() => info.or(emptyState).isVisible());
  }

  /**
   * Clicks the Tests tab, waiting for either the empty-state "New test
   * suite" button or the Test Suites list to render. This
   * tab only renders at all while Preferences -> General's "Enable legacy
   * unit tests" setting is on — callers should go through
   * `WorkspaceFlow.openTests()` rather than this directly, since it turns
   * that setting on first.
   */
  async openTestsTab(): Promise<void> {
    await this.page.getByTestId("api-collection-tab-tests").click();
    await expect(
      this.page.getByRole("button", { name: "New test suite" }),
    ).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Clicks "Remove custom ruleset" and waits for the toolbar to revert to
   * the default OAS ruleset label.
   */
  async removeRuleset(): Promise<void> {
    await this.page.locator(this.REMOVE_RULESET_BUTTON).click();
    await new ModalComponent(this.page).clickButton("Remove");
    await expect(this.page.getByText(this.DEFAULT_RULESET_LABEL)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Double-clicks the currently open suite's editable title, retypes it,
   * and confirms with Enter.
   */
  async renameTestSuite(currentName: string, newName: string): Promise<void> {
    const detailPane = this.page.locator("#workspace-content");
    await detailPane
      .locator("[data-editable]")
      .filter({ hasText: currentName })
      .dblclick();
    const input = detailPane.getByRole("textbox").first();
    await input.fill(newName);
    await input.press("Enter");
    await expect(
      detailPane.locator("[data-editable]").filter({ hasText: newName }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    await expect(
      new TableComponent(
        this.page,
        this.page.locator(this.TEST_SUITES_LIST),
      ).row(newName),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Double-clicks `currentName`'s editable title within the Unit tests
   * list, retypes it, and confirms with Enter.
   */
  async renameUnitTest(currentName: string, newName: string): Promise<void> {
    const list = this.page.locator(this.UNIT_TESTS_LIST);
    await list
      .locator("[data-editable]")
      .filter({ hasText: currentName })
      .dblclick();
    const input = list.getByRole("textbox").first();
    await input.fill(newName);
    await input.press("Enter");
    await expect(
      list.locator("[data-editable]").filter({ hasText: newName }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks "Run all tests" for the currently open suite and waits for the
   * resulting "Tests passed/failed" screen to render.
   */
  async runAllTests(): Promise<void> {
    await this.page.locator(this.RUN_ALL_TESTS_BUTTON).click();
    await expect(
      this.page.getByRole("heading", { name: /Tests (passed|failed)/ }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Opens the spec format menu and selects the given format, waiting
   * for the format button's label to update to confirm the change took
   * effect.
   */
  async selectFormat(format: SpecFormat): Promise<void> {
    const formatButton = this.page.locator(this.FORMAT_BUTTON);
    await formatButton.click();
    await new DropdownComponent(this.page, formatButton)
      .item(format, false)
      .click();
    await expect(formatButton).toHaveText(format, { timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks `suiteName`'s row in the Test Suites sidebar, navigating into
   * it (a no-op if it's already the selected suite), and waits for it to
   * become the selected row.
   */
  async selectTestSuite(suiteName: string): Promise<void> {
    const row = new TableComponent(
      this.page,
      this.page.locator(this.TEST_SUITES_LIST),
    ).row(suiteName);
    await row.click();
    await expect(row).toHaveAttribute("aria-selected", "true", {
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Replaces the entire spec editor's content via CodeMirror's
   * `setValue()` API.
   */
  async setSpecification(text: string): Promise<void> {
    await this.setCodeMirrorValue(this.page.locator(this.SPEC_EDITOR), text);
    await this.waitForFieldPersisted(
      ["insomnia.ApiSpec.db"],
      (doc) => doc.contents,
      text,
    );
  }

  /**
   * Clicks the docs-preview toggle, waiting for `.pane-two` to flip to the
   * opposite of its visibility beforehand.
   */
  async togglePreview(): Promise<boolean> {
    const wasOpen = await this.isPreviewOpen();
    await this.page.locator(this.PREVIEW_TOGGLE).click();
    await (wasOpen
      ? expect(this.page.locator(this.PANE_TWO)).toBeHidden({
          timeout: DEFAULT_TIMEOUT,
        })
      : expect(this.page.locator(this.PANE_TWO)).toBeVisible({
          timeout: DEFAULT_TIMEOUT,
        }));
    return !wasOpen;
  }

  /**
   * Clicks "Upload custom ruleset" (the native file-open dialog must
   * already be stubbed — see `FlowContext.stubFileChooser`) and waits for either outcome to settle: the
   * "View selected ruleset content" button (ruleset accepted) or the
   * "Invalid Spectral Ruleset" error dialog (ruleset rejected). On
   * rejection `@throwOnDialog` rejects with the dialog's text, leaving the
   * dialog open — dismiss it via `closeDialog()` — it's the app's shared
   * error modal, so no dedicated close method lives here.
   */
  @throwOnDialog()
  async uploadRuleset(): Promise<void> {
    await this.page.locator(this.UPLOAD_RULESET_BUTTON).click();

    const success = this.page.locator(this.VIEW_RULESET_BUTTON);
    const invalid = this.page.getByText("Invalid Spectral Ruleset", {
      exact: true,
    });
    await expect(success.or(invalid)).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Expands an outline section (if collapsed) and reads the `data-key` of
   * every entry under it, in panel order.
   */
  async getOutlineEntryKeys(section: OutlineSection): Promise<string[]> {
    const prefix = OUTLINE_SECTIONS[section].prefix;
    await this.expandOutlineSection(
      this.page.getByRole("button", {
        name: OUTLINE_SECTIONS[section].label,
        exact: true,
      }),
      `[data-key^="${prefix}"]`,
    );
    return this.page
      .locator(`[data-key^="${prefix}"]`)
      .evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.key!));
  }

  /**
   * Expands an outline section (if collapsed) and clicks one entry, which
   * makes the editor select the matching line. For a `paths` entry, pass
   * `method` to click that method's badge instead of the path row.
   */
  async clickOutlineEntry(
    section: OutlineSection,
    name: string | number,
    method?: HttpMethod,
  ): Promise<void> {
    const key = `${OUTLINE_SECTIONS[section].prefix}${name}`;
    await this.getOutlineEntryKeys(section);
    const entry = this.page.locator(`[data-key="${key}"]`);
    await (method
      ? entry.getByTestId(`spec-outline-method-${method}`).click()
      : entry.click());
  }

  /**
   * Reads where the spec editor's selection currently sits.
   */
  async getEditorSelection(): Promise<{ line: number; text: string }> {
    return this.page.locator(this.SPEC_EDITOR).evaluate((el) => {
      const cm = (el as any).CodeMirror;
      const { line } = cm.getCursor("from");
      return { line: line + 1, text: String(cm.getLine(line)).trim() };
    });
  }

  /**
   * Reads the spec editor's full text, exactly as it is in the editor.
   */
  async getSpecText(): Promise<string> {
    return this.readCodeMirror(this.page.locator(this.SPEC_EDITOR));
  }

  /**
   * Reads the method badges on one Paths outline row, in row order — each
   * badge's method (from its test id) and the label it displays.
   */
  async getPathMethodBadges(path: string): Promise<OutlineMethodBadge[]> {
    await this.getOutlineEntryKeys("paths");
    return this.page
      .locator(`[role="row"][data-key="paths.${path}"]`)
      .locator('[data-testid^="spec-outline-method-"]')
      .evaluateAll((badges) =>
        badges.map((badge) => ({
          method: (badge as HTMLElement).dataset.testid!.replace(
            "spec-outline-method-",
            "",
          ),
          label: (badge.textContent ?? "").trim(),
        })),
      );
  }

  /**
   * Clicks one method badge on a Paths outline row, which makes the editor
   * select the matching operation. Takes the method as a string because a
   * custom method (e.g. `PURGE`) is not an `HttpMethod`.
   */
  async clickPathMethodBadge(path: string, method: string): Promise<void> {
    await this.getOutlineEntryKeys("paths");
    await this.page
      .locator(`[role="row"][data-key="paths.${path}"]`)
      .getByTestId(`spec-outline-method-${method}`)
      .click();
  }

  /**
   * Expands the outline's Webhooks section (if collapsed) and reads every
   * row: its name and the label of each method badge on it.
   */
  async getWebhookEntries(): Promise<WebhookEntry[]> {
    await this.expandOutlineSection(
      this.page.getByRole("button", { name: "Webhooks", exact: true }),
      this.WEBHOOK_ROWS,
    );
    return this.page.locator(this.WEBHOOK_ROWS).evaluateAll((rows) =>
      rows.map((row) => ({
        name: (row as HTMLElement).dataset.key!,
        methods: Array.from(row.querySelectorAll("button")).map((badge) =>
          (badge.textContent ?? "").trim(),
        ),
      })),
    );
  }

  /**
   * Clicks a webhook's row in the outline, which makes the editor select
   * that webhook.
   */
  async clickWebhookEntry(name: string): Promise<void> {
    await this.getWebhookEntries();
    await this.page
      .locator(`${this.WEBHOOK_ROWS}[data-key="${name}"]`)
      .locator("span.truncate")
      .click();
  }

  /**
   * Clicks one method badge on a webhook's outline row, which makes the
   * editor select that operation.
   */
  async clickWebhookMethodBadge(name: string, method: string): Promise<void> {
    await this.getWebhookEntries();
    await this.page
      .locator(`${this.WEBHOOK_ROWS}[data-key="${name}"]`)
      .getByTestId(`spec-outline-webhook-method-${method}`)
      .click();
  }

  /**
   * Opens the toolbar's Generate menu, reads whether its Requests item is
   * enabled, then closes the menu again without choosing anything.
   */
  async isGenerateRequestsEnabled(): Promise<boolean> {
    await this.page.locator(this.GENERATE_BUTTON).click();
    const item = this.page.locator(this.GENERATE_REQUESTS_ITEM);
    await expect(item).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    const isDisabled = (await item.getAttribute("aria-disabled")) === "true";
    await this.page.keyboard.press("Escape");
    await expect(item).toBeHidden({ timeout: DEFAULT_TIMEOUT });
    return !isDisabled;
  }

  /**
   * Chooses Generate -> Requests from the toolbar and waits for the app to
   * redirect to the collection's Debug view, where the generated requests
   * are listed.
   */
  async clickGenerateRequests(): Promise<void> {
    await this.page.locator(this.GENERATE_BUTTON).click();
    await this.page.locator(this.GENERATE_REQUESTS_ITEM).click();
    await expect(this.page).toHaveURL(/\/debug/, { timeout: ACTION_TIMEOUT });
  }

  private async expandOutlineSection(
    button: Locator,
    rowSelector: string,
  ): Promise<void> {
    const isCollapsed =
      (await button.locator('svg[data-icon="plus"]').count()) > 0;
    if (isCollapsed) {
      await button.click();
    }
    await expect(this.page.locator(rowSelector).first()).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Parses a single lint entry row's header button — its rule id,
   * occurrence count, description, and severity (from the warning-triangle
   * vs. error-circle icon) — without expanding the row.
   */
  private async getLintRowSummary(
    row: Locator,
  ): Promise<Omit<LintEntry, "lineRefs"> | undefined> {
    const header = row.getByRole("button").first();
    const text = await header.innerText({ timeout: 2_000 });
    const match = text.match(/^\((\d+)\)\s*(\S+):\s*(.+)$/s);
    if (!match) return undefined;

    const severity =
      (await header.locator('svg[data-icon="triangle-exclamation"]').count()) >
      0
        ? LintSeverity.Warning
        : LintSeverity.Error;

    return {
      code: match[2],
      description: match[3].trim(),
      severity,
    };
  }
}

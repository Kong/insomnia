import { HttpMethod } from "@package/enums/http-method";
import { RulesetType } from "@package/enums/ruleset-type";
import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import type {
  PathItem} from "@package/models/collection";
import {
  Info,
  License,
  Specification,
} from "@package/models/collection";
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

export class SpecPage extends BasePage {
  // Spec editor / lint panel / legacy unit tests — rendered on a
  // Collection's landing view once it carries an ApiSpec (the former
  // standalone Document workspace's UI lives in this same view).
  private readonly PANE_ONE = '[data-panel-id="spec-pane-one"]';
  private readonly SPEC_EDITOR = '[data-testid="CodeEditor"] .CodeMirror';
  private readonly VIEW_RULESET_BUTTON =
    'button[aria-label="View selected ruleset content"]';

  // --- Spec editor / lint panel / legacy unit tests (folded
  // into this page from the former standalone Document workspace) ---

  /**
   * Reads the "OpenAPI x.y.z" version label shown in the toolbar's left
   * corner. Empty for a Swagger 2.0 spec (which has no `openapi` field) or
   * a collection with no spec content yet — neither renders this label at
   * all.
   */
  async getOpenApiVersion(): Promise<string> {
    const label = this.page
      .locator(this.PANE_ONE)
      .first()
      .getByText(/OpenAPI \d/)
      .first();
    if ((await label.count()) === 0) return "";
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
    await this.expandOutlineSection(pathsButton, '[data-key^="paths."]');
    const pathRows = await this.page
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
      );

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
    await this.waitForStableValue(() =>
      info.or(emptyState).isVisible(),
    );
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
}

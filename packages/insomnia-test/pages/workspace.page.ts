import { expect } from "@playwright/test";
import type { Locator, Page } from "playwright-core";

import type { ContextMenuItem } from "../enums/context-menu-items";
import { HttpMethod } from "../enums/http-method";
import { LintSeverity } from "../enums/lint-severity";
import { ProjectType } from "../enums/project-types";
import { RulesetType } from "../enums/ruleset-type";
import type { SpecFormat } from "../enums/spec-format";
import { TreeNodeType } from "../enums/tree-node-types";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import type {
  LintEntry,
  PathItem} from "../models/collection";
import {
  Info,
  License,
  Specification,
} from "../models/collection";
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

/** A single row read back from the "Tests passed/failed" result screen. */
export interface UnitTestResultRow {
  title: string;
  passed: boolean;
}

export interface TreeNode {
  _id: string;
  name: string;
  type: TreeNodeType;
  children: TreeNode[];
}

/** The sidebar's mid-drag drop indicator, read via `WorkspacePage.getDropIndicator()`. */
export interface DropIndicator {
  isValid: boolean;
  isInto: boolean;
  folderName: string | null;
  insertBetween: { before: string; after: string } | null;
}

interface TreeRow {
  key: string;
  name: string;
  indent: number;
  order: number;
}

export class Tree {
  readonly roots: TreeNode[];

  constructor(roots: TreeNode[]) {
    this.roots = roots;
  }

  /**
   * Scrapes the project navigation tree grid into a flat set of rows,
   * scrolling the container until no new rows appear and the bottom is
   * reached, then reconstructs the hierarchy from indentation. This is
   * needed because the tree is virtualized, so not all nodes are in the
   * DOM at once.
   * @param page - The Playwright page containing the navigation tree
   * @returns A Tree built from the fully-scraped rows
   */
  static async fromPage(page: Page): Promise<Tree> {
    const grid = page.getByRole("grid", { name: "Project Navigation Tree" });
    await expect(grid).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    const scroller = page.getByTestId("project-navigation-tree-container");
    const rows = grid.locator('div[role="row"][data-key]');
    const collected = new Map<string, TreeRow>();

    let previousSize = -1;
    let atBottom = false;
    while (collected.size !== previousSize || !atBottom) {
      previousSize = collected.size;

      await Tree.expandAllCollapsed(grid);

      const scraped = await rows.evaluateAll((els) =>
        els.map((el) => {
          const key = el.dataset.key ?? "";
          const name = el.getAttribute("aria-label") ?? "";

          const inner = el.querySelector<HTMLElement>(
            '[data-testid^="project-node-"],[data-testid^="workspace-node-"],[data-testid^="request-node-"],[data-testid^="empty-node-"]',
          );
          const indent = inner
            ? Number.parseFloat(getComputedStyle(inner).paddingLeft) || 0
            : 0;

          const matrix = getComputedStyle(el).transform;
          const match = matrix.match(/matrix\(([^)]+)\)/);
          const order = match ? Number.parseFloat(match[1].split(",")[5]) || 0 : 0;

          return { key, name, indent, order };
        }),
      );

      for (const row of scraped) {
        if (row.key) collected.set(row.key, row);
      }

      atBottom = await scroller.evaluate((el) => {
        const before = el.scrollTop;
        el.scrollBy(0, el.clientHeight);
        return el.scrollTop === before;
      });
      await page.waitForTimeout(100);
    }

    return Tree.fromRows([...collected.values()]);
  }

  /**
   * Rebuilds the parent/child hierarchy from a flat list of tree rows by
   * sorting them into visual order and using each row's indentation level
   * to determine nesting.
   * @param rows - The flat, unordered tree rows scraped from the DOM
   * @returns A Tree whose roots reflect the reconstructed hierarchy
   */
  static fromRows(rows: TreeRow[]): Tree {
    const ordered = [...rows].sort((a, b) => a.order - b.order);
    const roots: TreeNode[] = [];
    const stack: { node: TreeNode; indent: number }[] = [];

    for (const row of ordered) {
      const node: TreeNode = {
        _id: row.key,
        name: row.name,
        type: Tree.typeFromKey(row.key),
        children: [],
      };

      while (stack.length && stack[stack.length - 1].indent >= row.indent) {
        stack.pop();
      }

      if (stack.length === 0) {
        roots.push(node);
      } else {
        stack[stack.length - 1].node.children.push(node);
      }

      stack.push({ node, indent: row.indent });
    }

    return new Tree(roots);
  }

  /**
   * Clicks every currently-visible "Expand {name}" toggle on Collection/
   * Document/McpClient rows (e.g. Collections imported in bulk render
   * collapsed) so their children render in the DOM and get scraped along
   * with everything else. Deliberately scoped to `wrk_`-keyed rows only —
   * sibling Project rows (`proj_`-keyed) are never auto-expanded, since
   * those can hold unrelated, pre-existing content outside the current
   * test's scope. Capped to guard against an unexpected toggle that
   * doesn't actually collapse on click.
   * @param grid - The navigation tree grid to search for collapsed rows
   */
  private static async expandAllCollapsed(grid: Locator): Promise<void> {
    const collapsedWorkspaceRows = grid.locator(
      'div[role="row"][data-key^="wrk_"]:has(button[aria-label^="Expand "])',
    );
    const alreadyClicked = new Set<string>();
    for (let clicks = 0; clicks < 50; clicks++) {
      const keys = await collapsedWorkspaceRows.evaluateAll((rows) =>
        rows.map((row) => row.dataset.key ?? ""),
      );
      const key = keys.find((k) => k && !alreadyClicked.has(k));
      if (!key) return;
      alreadyClicked.add(key);

      const stableRow = grid.locator(`div[role="row"][data-key="${key}"]`);
      const expandButton = stableRow.getByRole("button", {
        name: /^Expand /,
      });
      try {
        await stableRow.scrollIntoViewIfNeeded({ timeout: 2000 });
        await expandButton.click({ timeout: 2000 });
        await expect(expandButton)
          .toBeHidden({ timeout: 100 })
          .catch(() => {});
      } catch {}
    }
  }

  private static typeFromKey(key: string): TreeNodeType {
    if (key.startsWith("empty-project")) return TreeNodeType.Empty;
    if (key.startsWith("proj_")) return TreeNodeType.Project;
    if (key.startsWith("wrk_")) return TreeNodeType.Workspace;
    if (key.includes("req_")) return TreeNodeType.Request;
    // startsWith, not includes — an empty folder's placeholder child key
    // is "empty-folder-fld_...", which would otherwise also match.
    if (key.startsWith("fld_")) return TreeNodeType.Folder;
    return TreeNodeType.Unknown;
  }

  /**
   * Depth-first flattens the tree into a single array, useful for
   * searching across all nodes regardless of nesting.
   * @returns All nodes in the tree, in depth-first order
   */
  flatten(): TreeNode[] {
    const out: TreeNode[] = [];
    const walk = (nodes: TreeNode[]) => {
      for (const node of nodes) {
        out.push(node);
        walk(node.children);
      }
    };
    walk(this.roots);
    return out;
  }
}

export class WorkspacePage extends BasePage {
  private readonly ADD_TAB_BUTTON = '[aria-label="Tab Plus"]';

  private readonly NEW_PROJECT_BUTTON: string =
    'button[aria-label="Create new Project"]';

  private readonly NEW_PROJECT_DIALOG =
    "[aria-label='Create or update dialog']";

  private readonly PROJECT_NAME: string = 'input[name="name"]';

  private readonly PROMPT_INPUT: string = 'input[id="prompt-input"]';

  private readonly TAB_LIST = '[aria-label="Insomnia Tabs"]';

  private readonly TAB_ROW = `${this.TAB_LIST} [role="row"]`;

  // Spec editor / lint panel / legacy unit tests — rendered on a
  // Collection's landing view once it carries an ApiSpec (INS-3528 folded
  // the former standalone Document workspace's UI into this same view).
  private readonly DEFAULT_RULESET_LABEL = "Default OAS Ruleset";
  private readonly FORMAT_BUTTON = 'button[aria-label="Spec format"]';
  private readonly LINT_ENTRY_ROW = "div[aria-expanded]";
  private readonly LINT_PANEL = '[data-testid="lint-panel"]';
  private readonly LINT_PANEL_TOGGLE = '[data-testid="lint-panel-toggle"]';
  private readonly NEW_SUITE_BUTTON = 'button:has-text("New test suite")';
  private readonly NEW_TEST_BUTTON = 'button[aria-label="New test"]';
  private readonly NO_LINT_PROBLEMS = "No lint problems";
  private readonly PANE_ONE = ".pane-one";
  private readonly PANE_TWO = ".pane-two";
  private readonly PREVIEW_TOGGLE = '[data-testid="preview-toggle"]';
  private readonly REMOVE_RULESET_BUTTON =
    'button[aria-label="Remove custom ruleset"]';
  private readonly RUN_ALL_TESTS_BUTTON = 'button[aria-label="Run all tests"]';
  private readonly SPEC_EDITOR = '[data-testid="CodeEditor"] .CodeMirror';
  private readonly TEST_RESULTS = '[aria-label="Test results"]';
  private readonly TEST_SUITES_LIST = '[aria-label="Test Suites"]';
  private readonly UNIT_TESTS_LIST = '[aria-label="Unit tests"]';
  private readonly UPLOAD_RULESET_BUTTON =
    'button[aria-label="Upload custom ruleset"]';
  private readonly VIEW_RULESET_BUTTON =
    'button[aria-label="View selected ruleset content"]';

  /**
   * Opens the "+" add-tab menu and clicks "Add request to current
   * collection", creating a new HTTP request under the active tab's
   * collection and opening it as a new tab.
   */
  async addRequestToCurrentCollection(): Promise<void> {
    const rows = this.page.locator(this.TAB_ROW);
    const before = await rows.count();
    await this.openAddTabMenu();
    await this.page
      .getByRole("menuitem", { name: "Add request to current collection" })
      .click();
    await expect(rows).toHaveCount(before + 1, { timeout: 10_000 });
  }

  /**
   * Clicks the given tab, making it the active tab, and waits for the
   * route change to settle before returning.
   * @param name - The tab's request/resource name
   */
  async clickTab(name: string): Promise<void> {
    await this.tab(name).click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Clicks a tab's close ("x") button.
   * @param name - The tab's request/resource name
   */
  async closeTab(name: string): Promise<void> {
    await this.tab(name).locator('[data-testid="tab-close-button"]').click();
  }

  /**
   * Reads back the currently active (selected) tab's name.
   * @returns The active tab's name, or undefined if no tab is selected
   */
  async getActiveTabName(): Promise<string | undefined> {
    const active = this.page.locator(`${this.TAB_ROW}[aria-selected="true"]`);
    if ((await active.count()) === 0) return undefined;
    return this.tabName(active.first());
  }

  /**
   * Reads back this tab's method tag text (e.g. "GET"), for request
   * tabs.
   * @param name - The tab's request name
   * @returns The tag text shown on the tab
   */
  async getTabMethodTag(name: string): Promise<string> {
    return (
      await this.tab(name).locator('[aria-label="Tab Tag"]').innerText()
    ).trim();
  }

  /**
   * Reads back the names of every currently open tab, in on-screen
   * (left-to-right) order.
   * @returns The open tabs' names
   */
  async getTabNames(): Promise<string[]> {
    const rows = this.page.locator(this.TAB_ROW);
    const count = await rows.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      names.push(await this.tabName(rows.nth(i)));
    }
    return names;
  }

  /**
   * Checks whether a tab with the given name is currently open.
   * @param name - The tab's request/resource name
   * @returns Whether a matching tab exists
   */
  async isTabOpen(name: string): Promise<boolean> {
    return (await this.tab(name).count()) > 0;
  }

  /**
   * Double-clicks a temporary (italicized preview) tab to pin it, so
   * navigating to a different request reuses a new temporary tab instead
   * of replacing this one.
   * @param name - The tab's request/resource name
   */
  async pinTab(name: string): Promise<void> {
    await this.tab(name).dblclick();
  }

  /**
   * Opens the tab bar's "+" add-tab menu.
   */
  private async openAddTabMenu(): Promise<void> {
    await this.page.locator(this.ADD_TAB_BUTTON).click();
  }

  /**
   * Clicks a context-menu item, matching either a menuitem or a
   * menuitemradio role since some menu entries render as radio options.
   * @param item - The context-menu item to click
   */
  async clickContextMenu(item: ContextMenuItem): Promise<void> {
    const menu = this.page.getByRole("menu");
    const menuItem = menu
      .getByRole("menuitem", { name: item, exact: true })
      .or(menu.getByRole("menuitemradio", { name: item, exact: true }));
    await menuItem.click();
  }

  /**
   * Clicks the "Create" button and waits for the create/update dialog to
   * close.
   */
  async clickCreate(): Promise<void> {
    const createButton = this.page.getByRole("button", {
      name: "Create",
      exact: true,
    });
    await createButton.click();
    await this.page
      .locator(this.NEW_PROJECT_DIALOG)
      .waitFor({ state: "hidden", timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks the "Ok" button on the currently open dialog and waits for it
   * to close. Used to dismiss an error dialog (e.g. one surfaced by an
   * action decorated with `@throwOnDialog`) so a test can continue with
   * further steps afterward.
   */
  async closeDialog(): Promise<void> {
    const dialog = this.page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Ok" }).click();
    await expect(dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Closes the currently open dialog via Escape — works across both
   * dialog implementations the app uses (the legacy Modal/ModalHeader
   * pair's labeled "Modal Close Button", and newer react-aria-components
   * Dialogs like Collection/Workspace Settings whose "x" button carries
   * no accessible name at all).
   */
  async closeModal(): Promise<void> {
    const dialog = this.page.getByRole("dialog");
    await this.page.keyboard.press("Escape");
    await expect(dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks the "Delete" (or "Delete ...") button in the currently open
   * dialog and waits for the dialog to close.
   */
  async clickDelete(): Promise<void> {
    const dialog = this.page.getByRole("dialog");
    await dialog.getByRole("button", { name: /^Delete/ }).click();
    await expect(dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks the "Duplicate" button and waits for the dialog to close.
   */
  async clickDuplicate(): Promise<void> {
    const dialog = this.page.getByRole("dialog");
    await this.page
      .getByRole("button", { name: "Duplicate", exact: true })
      .click();
    await expect(dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks the "Create" button in the duplicate-request dialog and waits
   * for the dialog to close.
   */
  async clickDuplicateRequest(): Promise<void> {
    const dialog = this.page.getByRole("dialog");
    await this.page
      .getByRole("button", { name: "Create", exact: true })
      .click();
    await expect(dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  private readonly generateCodeDialog = this.page
    .getByRole("dialog")
    .filter({ hasText: "Generate Client Code" });

  private readonly generateCodeCodeMirror = this.generateCodeDialog.locator(
    '[data-testid="CodeEditor"] .CodeMirror',
  );

  /**
   * Reads the code snippet shown in the "Generate Client Code" dialog
   * (opened via `ContextMenuItem.GenerateCode`), then closes it via
   * "Done".
   * @returns The generated code snippet's text (curl by default)
   */
  async getGeneratedCode(): Promise<string> {
    const code = await this.readCodeMirror(this.generateCodeCodeMirror);
    await this.generateCodeDialog.getByRole("button", { name: "Done" }).click();
    await expect(this.generateCodeDialog).toBeHidden({
      timeout: DEFAULT_TIMEOUT,
    });
    return code;
  }

  /**
   * Switches the "Generate Client Code" dialog's target language (the
   * first of its two dropdowns, e.g. "Shell"/"Node.js"/"Python"), then
   * waits for the snippet to actually re-render with the new target
   * before returning — confirmed live that the snippet updates
   * asynchronously (~1s) after the menu item click, so a caller reading
   * `getGeneratedCode()` immediately after would race a stale snippet.
   * No-ops if `target` is already the dropdown's current selection.
   * @param target - The target language's exact menu item label, e.g. "Node.js"
   */
  async setGenerateCodeTarget(target: string): Promise<void> {
    const dropdown = this.generateCodeDialog
      .getByTestId("DropdownButton")
      .nth(0);
    if ((await dropdown.innerText()).trim() === target) {
      return;
    }
    const before = await this.readCodeMirror(this.generateCodeCodeMirror);
    await dropdown.locator("button").click({ force: true });
    await this.page
      .getByRole("menuitem", { name: target, exact: true })
      .click();
    await expect(this.page.getByRole("menuitem")).toHaveCount(0, {
      timeout: DEFAULT_TIMEOUT,
    });
    await expect
      .poll(() => this.readCodeMirror(this.generateCodeCodeMirror), {
        timeout: DEFAULT_TIMEOUT,
      })
      .not.toBe(before);
  }

  /**
   * Switches the "Generate Client Code" dialog's client library (the
   * second dropdown, whose options depend on the currently-selected
   * target — e.g. Node.js offers HTTP/Request/Unirest/Axios/Fetch), then
   * waits for the snippet to re-render with the new client, same as
   * `setGenerateCodeTarget()`. No-ops if `client` is already the
   * dropdown's current selection.
   * @param client - The client's exact menu item label, e.g. "Axios"
   */
  async setGenerateCodeClient(client: string): Promise<void> {
    const dropdown = this.generateCodeDialog
      .getByTestId("DropdownButton")
      .nth(1);
    if ((await dropdown.innerText()).trim() === client) {
      return;
    }
    const before = await this.readCodeMirror(this.generateCodeCodeMirror);
    await dropdown.locator("button").click({ force: true });
    await this.page
      .getByRole("menuitem", { name: client, exact: true })
      .click();
    await expect(this.page.getByRole("menuitem")).toHaveCount(0, {
      timeout: DEFAULT_TIMEOUT,
    });
    await expect
      .poll(() => this.readCodeMirror(this.generateCodeCodeMirror), {
        timeout: DEFAULT_TIMEOUT,
      })
      .not.toBe(before);
  }

  /**
   * Clicks the "Create new Project" button and waits for the
   * create/update dialog to appear.
   */
  async clickNewProject(): Promise<void> {
    await this.page.locator(this.NEW_PROJECT_BUTTON).click();
    await expect(this.page.locator(this.NEW_PROJECT_DIALOG)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Logs out via the header's user-dropdown menu ("Log out" -> confirm
   * "Log Out" in the modal), then waits for the login screen's "Use local
   * Scratch Pad" entry point to appear. Works even against a session
   * injected directly via `INSOMNIA_SESSION` (not a real backend login) —
   * confirmed live: `logout()` only clears local session state.
   */
  async logOut(): Promise<void> {
    await this.page
      .getByTestId("user-dropdown")
      .filter({ visible: true })
      .click();
    await this.page.getByText("Log out").click();
    await this.page.getByRole("button", { name: "Log Out" }).click();
    await expect(this.page.getByLabel("Use local Scratch Pad")).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Clicks the login screen's "Use local Scratch Pad" entry point and
   * waits for the Scratch Pad workspace to load. Must be called after
   * `logOut()`.
   */
  async clickUseLocalScratchPad(): Promise<void> {
    await this.page.getByLabel("Use local Scratch Pad").click();
    await expect(
      this.page.getByRole("heading", { name: "Unlock full features" }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Reports whether a login-screen entry point (e.g. `"Continue with
   * Email"`, `"Use local Scratch Pad"`) is currently visible. Must be
   * called after `logOut()`.
   * @param name - The entry point's accessible label
   */
  async isLoginEntryPointVisible(name: string): Promise<boolean> {
    return this.page.getByLabel(name).isVisible();
  }

  /**
   * Reports whether the Scratch Pad workspace's "Unlock full features"
   * sign-up nudge is currently visible. Must be called after
   * `clickUseLocalScratchPad()`.
   */
  async isUnlockFullFeaturesVisible(): Promise<boolean> {
    return this.page
      .getByRole("heading", { name: "Unlock full features" })
      .isVisible();
  }

  /**
   * Scrolls a tree node's row into view and left-clicks it.
   * @param node - The tree node to click
   */
  async clickNode(node: TreeNode): Promise<void> {
    const row = this.page
      .getByTestId("project-navigation-tree-container")
      .locator(`div[role="row"][data-key="${node._id}"]`);
    await row.scrollIntoViewIfNeeded();
    await row.click();
  }

  /**
   * Focuses the given folder's row and presses the Right arrow key,
   * expanding it (a no-op if it's already expanded). Waits for the row's
   * "Collapse {name}" toggle to actually render before returning —
   * confirmed live that `project-navigation-sidebar.tsx`'s own arrow-key
   * handler flips this asynchronously (`toggleRequestGroups()` reads
   * `requestGroupMeta` via a DB round trip before patching the UI's query
   * cache), so the bare keypress can resolve tens of ms before the row's
   * expanded state actually changes.
   * @param node - The folder node to expand
   */
  async expand(node: TreeNode): Promise<void> {
    await this.pressArrowOnNode(node, "ArrowRight");
    await this.waitForExpanded(node, true);
  }

  /**
   * Focuses the given folder's row and presses the Left arrow key,
   * collapsing it (a no-op if it's already collapsed). See `expand()` for
   * why this waits for the toggle to settle rather than returning as soon
   * as the keypress itself resolves.
   * @param node - The folder node to collapse
   */
  async collapse(node: TreeNode): Promise<void> {
    await this.pressArrowOnNode(node, "ArrowLeft");
    await this.waitForExpanded(node, false);
  }

  /**
   * Polls `isExpanded()` until it reaches the expected state, rather than
   * trusting a single snapshot read right after a keypress — see
   * `expand()`'s doc comment for the underlying async gap this covers.
   * @param node - The folder node to check
   * @param expected - The expanded state to wait for
   */
  private async waitForExpanded(node: TreeNode, expected: boolean): Promise<void> {
    await expect(async () => {
      expect(await this.isExpanded(node)).toBe(expected);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Focuses a tree row (Playwright's `press()` focuses its target first)
   * and sends the given arrow key, mirroring the sidebar's own
   * `onKeyDownCapture` expand/collapse handler.
   * @param node - The node whose row to focus
   * @param key - The arrow key to send
   */
  private async pressArrowOnNode(
    node: TreeNode,
    key: "ArrowRight" | "ArrowLeft",
  ): Promise<void> {
    const row = this.page
      .getByTestId("project-navigation-tree-container")
      .locator(`div[role="row"][data-key="${node._id}"]`);
    await row.scrollIntoViewIfNeeded();
    await row.press(key);
  }

  /**
   * Checks whether a folder node is currently expanded, via its own
   * "Collapse {name}" toggle button (only rendered while expanded — the
   * same convention `expandAllCollapsed()` reads for "Expand {name}").
   * @param node - The folder node to check
   * @returns Whether the folder is currently expanded
   */
  async isExpanded(node: TreeNode): Promise<boolean> {
    const row = this.page
      .getByTestId("project-navigation-tree-container")
      .locator(`div[role="row"][data-key="${node._id}"]`);
    return (
      (await row
        .getByRole("button", { name: `Collapse ${node.name}` })
        .count()) > 0
    );
  }

  /**
   * Clicks the given node to select it, then sends the platform's "show
   * create menu" shortcut (Cmd+N on macOS, Ctrl+N elsewhere), opening the
   * Sidebar Shortcut Create Menu targeted at that folder/collection/project.
   * Confirmed live: the shortcut only opens the menu — it does not create
   * anything by itself, unlike `workspaceFlow.create()`'s own "+"-button
   * dropdown path.
   * @param node - The node to select before opening the create menu
   */
  async openCreateShortcut(node: TreeNode): Promise<void> {
    await this.clickNode(node);
    // Confirmed live: the click's own selection state (which the sidebar
    // syncs from an async route-resource fetch, not synchronously off the
    // click) can still be catching up when Ctrl+N fires. If that catch-up
    // lands *after* the shortcut menu opens, the sidebar's own "close the
    // dropdown when the selected item changes" effect fires against it and
    // silently closes the menu moments after this method returns. Waiting
    // for the row's own `aria-selected` to settle first lets that catch-up
    // (and its effect) happen before the menu ever opens, so it can't
    // close a menu that doesn't exist yet.
    await this.waitForSelectionSettled(node);
    await this.page.keyboard.press("ControlOrMeta+n");
    await expect(this.page.getByRole("menu")).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Polls a row's `aria-selected` attribute until it reports `"true"`
   * across two consecutive reads — see `openCreateShortcut()`'s doc
   * comment for the async selection catch-up this waits out.
   * @param node - The node whose row was just clicked to select it
   */
  private async waitForSelectionSettled(node: TreeNode): Promise<void> {
    const row = this.page
      .getByTestId("project-navigation-tree-container")
      .locator(`div[role="row"][data-key="${node._id}"]`);
    let previous: string | null = null;
    await expect(async () => {
      const current = await row.getAttribute("aria-selected");
      // eslint-disable-next-line playwright/prefer-web-first-assertions -- needs the raw string to compare across polls for stability, not just assert against a fixed expected value
      expect(current).toBe("true");
      const stable = current === previous;
      previous = current;
      expect(stable).toBe(true);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Checks whether the Sidebar Shortcut Create Menu (opened via
   * `openCreateShortcut()`) is currently visible. Confirmed live:
   * matching this popover's `role="menu"` by its own
   * `aria-label="Sidebar Shortcut Create Menu"` is unreliable right after
   * it opens (its accessible name briefly resolves differently while
   * react-aria-components finishes mounting the popover) — a plain
   * `getByRole("menu")` is reliable instead, since only one menu is ever
   * open at a time in this app.
   */
  async isCreateShortcutShown(): Promise<boolean> {
    return (await this.page.getByRole("menu").count()) > 0;
  }

  /**
   * Checks whether the one-time "Welcome to focus mode" onboarding
   * popover is currently visible — shown the first time a workspace is
   * focused while `Settings.sidebarFocusForCollections` is on and it
   * hasn't been dismissed before.
   */
  async isFocusModePromptShown(): Promise<boolean> {
    return (
      (await this.page
        .getByRole("dialog", { name: "Sidebar focus mode onboarding" })
        .count()) > 0
    );
  }

  /**
   * Clicks the focus-mode onboarding popover's "Got It" button, dismissing
   * it. The dismissal is persisted to Settings, so it stays dismissed
   * across reloads/re-focusing.
   */
  async dismissFocusModePrompt(): Promise<void> {
    const onboarding = this.page.getByRole("dialog", {
      name: "Sidebar focus mode onboarding",
    });
    await onboarding.getByRole("button", { name: "Got It" }).click();
    await expect(onboarding).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks the sidebar's "Back to all projects" button, returning from a
   * collection's own (possibly focus-mode-narrowed) contents view to the
   * full project navigation tree.
   */
  async goBackToProject(): Promise<void> {
    await this.page
      .getByRole("button", { name: "Back to all projects" })
      .click();
  }

  /**
   * Clicks the "Rename" button in the currently open dialog and waits
   * for the dialog to close.
   */
  async clickRename(): Promise<void> {
    // Scoped to the dialog containing the rename prompt's own input,
    // rather than a bare getByRole("dialog") — an unrelated dialog open
    // at the same time (e.g. the focus-mode onboarding popover) also
    // matches role="dialog" and never closes on its own, which made the
    // unscoped version wait out its full timeout for the wrong dialog.
    const dialog = this.page
      .getByRole("dialog")
      .filter({ has: this.page.locator(this.PROMPT_INPUT) });
    await this.page
      .getByRole("button", { name: "Rename", exact: true })
      .click();
    await expect(dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Finds a node by id or name, optionally scoped to a parent's subtree.
   * Delegates to findNodeUnder, findNodeById, or findNode depending on
   * which identifying information is available.
   * @param item - Identifies the target node by id (preferred) or name
   * @param type - If given, restricts the match to nodes of this type
   * @param parent - If given, restricts the search to this node's subtree
   * @returns The matching node, or undefined if it is not found
   */
  async findItemNode(
    item: { id?: string; name: string },
    type?: TreeNodeType,
    parent?: TreeNode,
  ): Promise<TreeNode | undefined> {
    if (parent) return this.findNodeUnder(parent, item, type);
    if (item.id) return this.findNodeById(item.id, type);
    return this.findNode(item.name, type);
  }

  /**
   * Polls the tree until a node matching the given name (and optional
   * type) appears, since newly created nodes may not render immediately.
   * @param name - The node name to search for
   * @param type - If given, restricts the match to nodes of this type
   * @returns The matching node, or undefined if it never appears within the poll timeout
   */
  async findNode(
    name: string,
    type?: TreeNodeType,
  ): Promise<TreeNode | undefined> {
    return this.poll(async () => {
      const tree = await this.getTree();
      return tree
        .flatten()
        .find(
          (n) => n.name === name && (type === undefined || n.type === type),
        );
    });
  }

  /**
   * Polls the tree until a node matching the given id (and optional
   * type) appears, since newly created nodes may not render immediately.
   * @param id - The node id to search for
   * @param type - If given, restricts the match to nodes of this type
   * @returns The matching node, or undefined if it never appears within the poll timeout
   */
  private async findNodeById(
    id: string,
    type?: TreeNodeType,
  ): Promise<TreeNode | undefined> {
    return this.poll(async () => {
      const tree = await this.getTree();
      return tree
        .flatten()
        .find((n) => n._id === id && (type === undefined || n.type === type));
    });
  }

  /**
   * Polls the tree until a descendant of the given parent matching the
   * given id or name (and optional type) appears. Searches only within
   * the parent's subtree, not the whole tree.
   * @param parent - The ancestor node whose descendants are searched
   * @param item - Identifies the target node by id (preferred) or name
   * @param type - If given, restricts the match to nodes of this type
   * @returns The matching descendant node, or undefined if it never appears within the poll timeout
   */
  private async findNodeUnder(
    parent: TreeNode,
    item: { id?: string; name: string },
    type?: TreeNodeType,
  ): Promise<TreeNode | undefined> {
    return this.poll(async () => {
      const tree = await this.getTree();
      const root = tree.flatten().find((n) => n._id === parent._id);
      if (!root) return;

      const matches = (node: TreeNode) =>
        (item.id ? node._id === item.id : node.name === item.name) &&
        (type === undefined || node.type === type);

      const walk = (nodes: TreeNode[]): TreeNode | undefined => {
        for (const node of nodes) {
          if (matches(node)) return node;
          const found = walk(node.children);
          if (found) return found;
        }
        return undefined;
      };
      return walk(root.children);
    });
  }

  /**
   * Creates an API Collection meant to carry a spec, via the project
   * dashboard's empty-state "Enter API Spec" button (accessible name still
   * "Create document"; only rendered when the project has no workspaces
   * yet) rather than the project-tree "API Collection" context menu item —
   * since INS-3528, both are the exact same entry point into the same
   * "New Workspace" naming dialog (there is no longer a separate "Document"
   * workspace type or creation path). Fills its placeholder-labeled name
   * input and commits by pressing Enter (the input sits inside a native
   * form, so Enter submits it) instead of clicking a "Create" button.
   * @param name - The name to give the new collection
   */
  async createCollectionInEmptyState(name: string): Promise<void> {
    await this.page
      .getByRole("button", { name: "Create document", exact: true })
      .click();
    const input = this.page.getByPlaceholder(
      /Enter a name for your API Collection/,
    );
    await input.fill(name);
    await input.press("Enter");
    await this.navigate();
  }

  /**
   * Reads the current pane's breadcrumb trail (e.g. Project > Collection
   * > Request), in order. A Collection with no active request/folder
   * renders just the first two levels. A request's level renders its HTTP
   * method above its name (e.g. "GET\nMy Request"); that method prefix is
   * stripped so callers only see the label.
   * @returns The breadcrumb labels, in on-screen order
   */
  async getBreadcrumb(): Promise<string[]> {
    const labels = await this.page
      .locator('[data-testid^="workspace-breadcrumb-level-"]')
      .allInnerTexts();
    return labels.map((label) => label.replace(/^[A-Z]+\n/, ""));
  }

  /**
   * Polls `getBreadcrumb()` until it matches `expected`, rather than
   * trusting a single read right after selecting a node — the breadcrumb
   * lags the newly-selected item by a render tick.
   * @param expected - The breadcrumb labels to wait for, in on-screen order
   * @returns The settled breadcrumb labels
   */
  async waitForBreadcrumbSettled(expected: string[]): Promise<string[]> {
    let breadcrumb: string[] = [];
    await expect(async () => {
      breadcrumb = await this.getBreadcrumb();
      expect(breadcrumb).toEqual(expected);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    return breadcrumb;
  }

  /**
   * Convenience accessor for the full flattened list of tree nodes.
   * @returns All nodes in the current tree, in depth-first order
   */
  async getNodes() {
    return (await this.getTree()).flatten();
  }

  /**
   * Clicks the sidebar filter's "Clear search" button, restoring the
   * full unfiltered tree.
   */
  async clearSidebarFilter(): Promise<void> {
    await this.page.locator('[aria-label="Clear search"]').click();
    await this.page.waitForTimeout(500);
  }

  /**
   * Types into the sidebar's "Projects filter" search box, narrowing the
   * project/workspace/collection-child tree down to matching nodes.
   * @param text - The filter text to type
   */
  async filterSidebar(text: string): Promise<void> {
    await this.page
      .getByRole("searchbox", { name: "Projects filter" })
      .fill(text);
    await this.page.waitForTimeout(500);
  }

  /**
   * Checks whether a dialog with the given heading text is currently
   * open. Every simple modal in the app (Request/Collection Settings,
   * etc.) shares the same generic dialog role, so callers scope by
   * heading text to tell them apart.
   * @param headingText - Text expected somewhere in the dialog's heading
   * @returns Whether a matching dialog is currently open
   */
  async isModalOpen(headingText: string): Promise<boolean> {
    return (
      (await this.page
        .getByRole("dialog")
        .filter({ hasText: headingText })
        .count()) > 0
    );
  }

  /**
   * Checks whether a request currently appears in the sidebar's
   * top-level "Pinned" section (distinct from its regular row in its
   * actual folder position).
   * @param name - The request's name
   * @returns Whether the request is currently pinned
   */
  async isPinned(name: string): Promise<boolean> {
    return (
      (await this.page
        .locator(`[data-testid="pinned-request-node-${name}"]`)
        .count()) > 0
    );
  }

  /**
   * Renames a request in place via the sidebar's inline editable label
   * (double-click to edit, Enter to submit) — distinct from the
   * context-menu "Rename" dialog `workspaceFlow.rename()` drives.
   * @param name - The request's current name
   * @param newName - The name to give it
   */
  async renameRequestInline(name: string, newName: string): Promise<void> {
    const row = this.page.locator(`[data-testid="request-node-${name}"]`);
    await row.locator("[data-editable]").dblclick();
    await row.getByRole("textbox").fill(newName);
    await row.getByRole("textbox").press("Enter");
  }

  /**
   * Reads the request-type label (e.g. GET, GraphQL) shown next to a
   * request node's row.
   * @param node - The request tree node to inspect
   * @returns The trimmed request-type label text
   */
  async getRequestTypeLabel(node: TreeNode): Promise<string> {
    const row = this.page
      .getByTestId("project-navigation-tree-container")
      .locator(`div[role="row"][data-key="${node._id}"]`);
    const label = await row.locator('span[class*="w-10"]').first().innerText();
    return label.trim();
  }

  /**
   * Scrapes and reconstructs the current state of the project navigation
   * tree.
   * @returns The current Tree
   */
  async getTree(): Promise<Tree> {
    return await Tree.fromPage(this.page);
  }

  /**
   * Determines the kind of workspace item a tree node represents by
   * inspecting its row icon.
   * @param node - The workspace-level tree node to inspect
   * @returns The workspace item kind: "collection", "document", or "mcpClient"
   */
  /**
   * A legacy Document workspace (pre-INS-3528) still renders with its own
   * "file" icon in the tree even though it's functionally just a
   * Collection now — this doesn't distinguish that case, since nothing
   * branches on it anymore; both render as `"collection"`.
   */
  async getWorkspaceItemKind(
    node: TreeNode,
  ): Promise<"collection" | "mcpClient"> {
    const row = this.page
      .getByTestId("project-navigation-tree-container")
      .locator(`div[role="row"][data-key="${node._id}"]`);
    const icon = await row
      .locator('div[class*="bg-(--color-"] svg[data-icon]')
      .first()
      .getAttribute("data-icon");
    return icon === "mcp" ? "mcpClient" : "collection";
  }

  /**
   * Waits for the "Create new Project" button to be visible, confirming
   * the workspace/projects screen has loaded.
   */
  async navigate(): Promise<void> {
    await expect(this.page.locator(this.NEW_PROJECT_BUTTON)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Resolves a node reference to a full TreeNode, looking it up by name
   * (and optional id) if it isn't already a TreeNode.
   * @param parent - Either an existing TreeNode or a name/id reference to resolve
   * @returns The resolved TreeNode
   */
  async resolveNode(
    parent: TreeNode | { name: string; id?: string },
  ): Promise<TreeNode> {
    if ("_id" in parent) return parent as TreeNode;
    return (await this.findItemNode(parent))!;
  }

  /**
   * Scrolls a tree node's row into view and right-clicks it to open its
   * context menu.
   * @param node - The tree node to right-click
   */
  async rightClick(node: TreeNode): Promise<void> {
    const row = this.page
      .getByTestId("project-navigation-tree-container")
      .locator(`div[role="row"][data-key="${node._id}"]`);
    await row.scrollIntoViewIfNeeded();
    // A React Aria tooltip left open elsewhere in the tree (e.g. an
    // unsynced workspace node's "Click to fetch this file" hint) can
    // render above this row and intercept the click; Escape closes it
    // immediately instead of waiting out its hover close delay.
    await this.page.keyboard.press("Escape");
    await row.click({ button: "right" });
  }

  /**
   * Waits for a deleted node's row to actually disappear from the tree.
   * The delete confirmation dialog can close (and its promise resolve)
   * slightly before the underlying row is removed from the DOM, so a
   * `getNodes()`/`getTree()` read taken immediately after confirming a
   * delete can still briefly see the stale row.
   * @param node - The deleted node whose row should no longer be present
   */
  async waitForNodeRemoved(node: TreeNode): Promise<void> {
    const row = this.page
      .getByTestId("project-navigation-tree-container")
      .locator(`div[role="row"][data-key="${node._id}"]`);
    await expect(row).toHaveCount(0, { timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Presses the mouse down on a tree node's row and nudges it a few
   * pixels, crossing react-aria's own drag-start threshold so the row
   * picks up `data-dragging="true"`. Leaves the mouse button held down —
   * pair with one or more `dragOver()` calls and a final `releaseDrag()`.
   * @param node - The tree node to start dragging
   */
  async startDrag(node: TreeNode): Promise<void> {
    const row = this.dragRow(node);
    await row.scrollIntoViewIfNeeded();
    const box = (await row.boundingBox())!;
    await this.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.mouse.down();
    await this.page.mouse.move(
      box.x + box.width / 2,
      box.y + box.height / 2 + 4,
      { steps: 3 },
    );
    await expect(row).toHaveAttribute("data-dragging", "true", {
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Moves the currently-held drag pointer to a fractional point within a
   * target row, e.g. `yFraction: 0.05` hits the row's top edge band
   * (a "before" drop), `0.5` its middle (an "on" drop for a row that
   * accepts children), `0.95` its bottom edge band (an "after" drop).
   * `xFraction` matters only at a boundary that spans more than one
   * nesting depth (a folder's own trailing edge, an empty folder's
   * placeholder row) — the sidebar resolves the horizontal position into
   * a preferred indent level there, per `levelFromX()` in
   * `use-sidebar-drag-and-drop.tsx`; elsewhere it's ignored, only the row
   * itself and the vertical position matter.
   * @param node - The row to hover the drag over
   * @param xFraction - Horizontal position within the row, 0 (left edge) to 1 (right edge)
   * @param yFraction - Vertical position within the row, 0 (top edge) to 1 (bottom edge)
   */
  async dragOver(
    node: TreeNode,
    xFraction: number,
    yFraction: number,
  ): Promise<void> {
    const row = this.dragRow(node);
    await row.scrollIntoViewIfNeeded();
    const box = (await row.boundingBox())!;
    const x = box.x + box.width * xFraction;
    const y = box.y + box.height * yFraction;
    await this.page.mouse.move(x, y, { steps: 5 });
    await this.page.mouse.move(x, y + 1, { steps: 1 });
    await this.page.mouse.move(x, y, { steps: 1 });
  }

  /**
   * Same as `dragOver()`, but takes the horizontal position as an
   * absolute pixel offset from the row's left edge rather than a
   * fraction of its width — needed at a boundary spanning several
   * nesting depths, where `levelFromX()`'s indent-level math is
   * sensitive to a handful of pixels and a row-width-relative fraction
   * isn't precise enough to land on a specific depth.
   * @param node - The row to hover the drag over
   * @param xPixels - Horizontal position within the row, in pixels from its left edge
   * @param yFraction - Vertical position within the row, 0 (top edge) to 1 (bottom edge)
   */
  async dragOverPixels(
    node: TreeNode,
    xPixels: number,
    yFraction: number,
  ): Promise<void> {
    const row = this.dragRow(node);
    await row.scrollIntoViewIfNeeded();
    const box = (await row.boundingBox())!;
    const x = box.x + xPixels;
    const y = box.y + box.height * yFraction;
    await this.page.mouse.move(x, y, { steps: 5 });
    await this.page.mouse.move(x, y + 1, { steps: 1 });
    await this.page.mouse.move(x, y, { steps: 1 });
  }

  /**
   * Releases the mouse button, committing whichever drop target the last
   * `dragOver()` call left the indicator on.
   */
  async releaseDrag(): Promise<void> {
    await this.page.mouse.up();
  }

  /**
   * Convenience wrapper around `startDrag()`/`dragOver()`/`releaseDrag()`
   * for a scenario that doesn't need to inspect the indicator mid-drag.
   * @param source - The node to drag
   * @param target - The row to drop it on
   * @param xFraction - Horizontal position within the target row, 0-1 (default 0.5)
   * @param yFraction - Vertical position within the target row, 0-1 (default 0.5)
   */
  async dragAndDrop(
    source: TreeNode,
    target: TreeNode,
    xFraction = 0.5,
    yFraction = 0.5,
  ): Promise<void> {
    await this.startDrag(source);
    await this.dragOver(target, xFraction, yFraction);
    await this.releaseDrag();
  }

  /**
   * Reads the sidebar's currently rendered drop indicator — the custom
   * `<DropIndicator>` `use-sidebar-drag-and-drop.tsx` draws mid-drag,
   * before any drop actually commits. `insertBetween` comes from
   * react-aria's own generated accessible label ("Insert between A and
   * B"), naming the two rows the raw boundary sits between; `folderName`
   * comes from the sidebar's own destination-naming badge, which only
   * renders once a boundary is resolved to land inside a folder — not for
   * a plain "on" drop (a whole-row highlight with no name badge at all).
   * @returns The indicator's current state, or undefined if none is rendered
   */
  async getDropIndicator(): Promise<DropIndicator | undefined> {
    const indicator = this.page.locator(
      '[class*="outline-(--color-surprise)"], [class*="outline-(--color-danger)"]',
    );
    if ((await indicator.count()) === 0) return undefined;

    const target = indicator.first();
    const [className, ariaLabel, folderName] = await Promise.all([
      target.getAttribute("class"),
      target
        .locator('[aria-roledescription="drop indicator"]')
        .getAttribute("aria-label"),
      target
        .locator("span")
        .first()
        .innerText()
        .catch(() => ""),
    ]);
    const isValid = (className ?? "").includes("--color-surprise");
    const isInto = (className ?? "").includes("rounded-sm");
    const between = ariaLabel?.match(/^Insert between (.+) and (.+)$/);

    return {
      isValid,
      isInto,
      folderName: folderName || null,
      insertBetween: between
        ? { before: between[1], after: between[2] }
        : null,
    };
  }

  /**
   * Locates a tree row for drag-and-drop use.
   * @param node - The tree node whose row to locate
   */
  private dragRow(node: TreeNode): Locator {
    return this.page
      .getByTestId("project-navigation-tree-container")
      .locator(`div[role="row"][data-key="${node._id}"]`);
  }

  /**
   * Right-clicks a tree node by name and clicks a context-menu item by
   * its visible label. Unlike clickContextMenu, the label isn't
   * restricted to the fixed ContextMenuItem enum, so this also covers
   * dynamically-labeled entries such as plugin-injected menu items.
   * @param nodeName - The name of the node to right-click
   * @param contextMenu - The visible label of the context-menu item to click
   * @param parent - If given, restricts the node search to this node's subtree
   * @throws If the node or the context-menu item is never found
   */
  async clickItemContextMenu(
    nodeName: string,
    contextMenu: string,
    parent?: TreeNode,
  ): Promise<void> {
    const node = await this.findItemNode({ name: nodeName }, undefined, parent);
    if (!node) {
      throw new Error(`Tree node "${nodeName}" not found`);
    }
    await this.rightClick(node);

    const menuItem = this.page
      .getByRole("menu")
      .getByRole("menuitem", { name: contextMenu });
    try {
      await menuItem.waitFor({ state: "visible", timeout: DEFAULT_TIMEOUT });
    } catch {
      throw new Error(`Context menu item "${contextMenu}" not found`);
    }
    await menuItem.click();
  }

  /**
   * Selects the target project in the duplicate dialog's project
   * dropdown. If no project name is given, selects the option marked
   * "(current)".
   * @param projectName - The name of the project to select; defaults to the current project
   */
  async selectDuplicateProject(projectName?: string): Promise<void> {
    const select = this.page
      .getByRole("dialog")
      .locator('select[name="projectId"]');
    const options = await select.locator("option").allTextContents();
    const label = projectName
      ? options.find((o) => o.startsWith(projectName))
      : options.find((o) => o.includes("(current)"));
    if (!label) {
      throw new Error(
        `Project "${projectName ?? "(current)"}" not found in duplicate dialog`,
      );
    }
    await select.selectOption({ label });
  }

  /**
   * Fills the name field in the duplicate dialog and verifies the value
   * stuck.
   * @param name - The duplicate name to enter
   */
  async setDuplicateName(name: string): Promise<void> {
    const input = this.page.getByRole("dialog").locator('input[name="name"]');
    await input.fill(name);
    await expect(input).toHaveValue(name);
  }

  /**
   * Fills the generic prompt input (used for naming new items such as
   * requests, folders, or documents).
   * @param value - The value to enter
   */
  async setItemName(value: string): Promise<void> {
    await this.page.locator(this.PROMPT_INPUT).fill(value);
  }

  /**
   * Fills the new item name prompt input and verifies the value stuck.
   * @param name - The name to enter
   */
  async setNewItemName(name: string): Promise<void> {
    const input = this.page.locator(this.PROJECT_NAME);
    await input.click();
    await input.fill(name);
    await expect(input).toHaveValue(name);
  }

  /**
   * Fills the "File name" field shown alongside "Name" when creating a
   * Collection under a Git Sync project (Git projects store one file per
   * collection, decoupled from its display name). Must be called while the
   * create-collection dialog is open.
   * @param fileName - The on-disk file name (without extension)
   */
  async setCollectionFileName(fileName: string): Promise<void> {
    const input = this.page.getByRole("textbox", { name: "File name" });
    await input.click();
    await input.press("ControlOrMeta+a");
    await input.fill(fileName);
  }

  /**
   * Selects a project type in the create-project dialog. For Local and
   * Cloud projects, waits for the Create button to become enabled. For Git
   * projects, the Create button is replaced by a multi-step repo-detail
   * sub-form (credential setup, repo URL, branch, clone location), so this
   * instead waits for that sub-form's initial surface to appear — either
   * the "Setup Git Credentials" card (no credential configured yet) or the
   * "Git Setup Form" (a credential already exists) — leaving the rest of
   * the form to GitSyncPage/GitSyncFlow.
   * @param type - The project type to select
   */
  async setNewProjectType(type: ProjectType): Promise<void> {
    await this.page
      .locator(`div[aria-label="Project Type Item: ${type}"]`)
      .click();
    if (type === ProjectType.Git) {
      await expect(
        this.page
          .getByText("Setup Git Credentials")
          .or(this.page.getByRole("form", { name: "Git Setup Form" })),
      ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
      return;
    }
    await expect(
      this.page.getByRole("button", { name: "Create", exact: true }),
    ).toBeEnabled({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks a project-type tile in the create/update-project dialog without
   * waiting for a successful sub-form to appear afterward, unlike
   * `setNewProjectType()`. Needed when the type is expected to be blocked
   * (Git Sync disabled via feature flag), where that success wait would
   * never resolve.
   * @param type - The project type tile to click
   */
  async clickProjectTypeTile(type: ProjectType): Promise<void> {
    await this.page
      .locator(`div[aria-label="Project Type Item: ${type}"]`)
      .click();
  }

  /**
   * Waits until a parent node's first child is no longer the placeholder
   * "emptyCollection" row, i.e. a real child has been created, re-reading
   * the tree in a loop until that happens.
   * @param parentId - The id of the parent node to watch
   * @returns The parent's first real (non-placeholder) child node
   */
  async waitForFirstRealChild(parentId: string): Promise<TreeNode> {
    const deadline = Date.now() + DEFAULT_TIMEOUT;
    let children: TreeNode[] | undefined;
    do {
      if (Date.now() > deadline) {
        throw new Error(
          `waitForFirstRealChild: no real child appeared under "${parentId}" within ${DEFAULT_TIMEOUT}ms`,
        );
      }
      const tree = await this.getTree();
      const parentNode = tree.flatten().find((n) => n._id === parentId);
      // parentNode can go missing from the flattened tree even though it
      // still exists — e.g. Settings.sidebarFocusForCollections narrows
      // the sidebar to the parent's own contents once it's focused,
      // which drops its own row (and thus its `data-key`) from what
      // Tree.fromPage() scrapes, re-rooting the scraped tree at its
      // children instead. Falling back to the tree's own roots in that
      // case is the correct read of "the parent's children" either way.
      children = parentNode ? parentNode.children : tree.roots;
      // "emptyCollection"/"emptyFolder" — the placeholder child rendered
      // while a Collection or Folder has nothing in it yet. Guard with
      // ?. too: right after the create action fires, the parent's
      // children array can transiently be empty for a tick.
    } while (children[0]?.name?.startsWith("empty") ?? true);
    return children[0];
  }

  // --- Spec editor / lint panel / legacy unit tests (INS-3528: folded
  // into this page from the former standalone Document workspace) ---

  /**
   * Clicks "New test" inside the currently open suite and waits for a new
   * (default-named) test row to render.
   */
  async createTest(): Promise<void> {
    const rows = this.page.locator(this.UNIT_TESTS_LIST).getByRole("row");
    const before = await rows.count();
    await this.page.locator(this.NEW_TEST_BUTTON).click();
    await expect(rows).toHaveCount(before + 1, { timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks "New test suite", which creates a default-named suite and
   * navigates straight into it.
   */
  async createTestSuite(): Promise<void> {
    const rows = this.page.locator(this.TEST_SUITES_LIST).getByRole("row");
    const before = await rows.count();
    await this.page.locator(this.NEW_SUITE_BUTTON).click();
    await expect(rows).toHaveCount(before + 1, { timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Opens `suiteName`'s "Unit Test Actions" menu from the Test Suites list
   * and deletes it via the "Delete suite" confirm modal.
   * @param suiteName - The exact name of the suite to delete
   */
  async deleteTestSuite(suiteName: string): Promise<void> {
    const row = this.page
      .locator(this.TEST_SUITES_LIST)
      .getByRole("row", { name: suiteName });
    await row.getByLabel("Unit Test Actions").click();
    await this.page
      .getByRole("menuitemradio", { name: "Delete suite" })
      .click();

    const dialog = this.page.getByRole("dialog");
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
   * @returns The active spec format
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
   * @returns The parsed lint entries, e.g. `[{code: "oas3-schema", count: 1, description: 'must have required property "paths"', severity: LintSeverity.Error, lineRefs: ["Ln 3"]}]`
   */
  async getLintEntries(): Promise<LintEntry[]> {
    const rows = this.page.locator(this.LINT_PANEL).locator(this.LINT_ENTRY_ROW);
    const rowCount = await rows.count();
    const entries: LintEntry[] = [];

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      const summary = await this.getLintRowSummary(row);
      if (!summary) continue;

      if ((await row.getAttribute("aria-expanded")) !== "true") {
        await row.locator("> button").first().click();
      }
      const lineRefs = await row.getByText(/^Ln \d+$/).allInnerTexts();
      entries.push({ ...summary, lineRefs });
    }

    return entries;
  }

  /**
   * Reads every rule id currently listed in the (already expanded) lint
   * panel, without expanding any entry.
   * @returns The Spectral rule ids shown, e.g. `["oas3-schema"]`
   */
  async getLintEntryCodes(): Promise<string[]> {
    const rows = this.page.locator(this.LINT_PANEL).locator(this.LINT_ENTRY_ROW);
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
   * @returns `"none"` if the spec has no content yet, or the editor reports no lint problems; otherwise the parsed error/warning counts
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
   * @returns The active ruleset type
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
   * @returns The parsed specification, or `undefined` if there's no "Info" section at all (e.g. the collection has no recognized OpenAPI/Swagger spec)
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
            row.querySelectorAll('button[class*="http-method-"]'),
          ).map((button) => button.textContent?.trim() ?? ""),
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
   * Reads every test title and pass/fail state from the "Tests
   * passed/failed" result screen shown after `runAllTests()`.
   * @returns Each test's title and whether it passed
   */
  async getTestResultRows(): Promise<UnitTestResultRow[]> {
    const rows = this.page.locator(this.TEST_RESULTS).locator("> div");
    return rows.evaluateAll((els) =>
      els.map((el) => ({
        title: el.querySelector(".flex-1.truncate")?.textContent?.trim() ?? "",
        passed: !el.querySelector("code"),
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
    return this.page
      .locator(this.TEST_SUITES_LIST)
      .getByRole("row")
      .allInnerTexts();
  }

  /**
   * Reads every test name currently listed under the open suite.
   */
  async getUnitTestNames(): Promise<string[]> {
    return this.page
      .locator(this.UNIT_TESTS_LIST)
      .getByRole("row")
      .allInnerTexts();
  }

  /**
   * Checks whether the docs-preview pane (`.pane-two`) is currently
   * visible.
   */
  async isPreviewOpen(): Promise<boolean> {
    return this.page.locator(this.PANE_TWO).isVisible();
  }

  /**
   * Waits for the spec's CodeMirror editor to become visible, confirming
   * the collection's spec/landing view is ready for interaction.
   */
  async navigateSpec(): Promise<void> {
    await expect(this.page.locator(this.SPEC_EDITOR)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
    // The CodeMirror editor above can render before the Outline panel's
    // "Info" section has finished mounting, so a getSpecification() read
    // taken right after this resolves can still see an empty Outline and
    // report no specification at all. A collection with no spec authored
    // at all never gets an Outline/Info section though — it shows the
    // empty-state landing heading instead. Either can also flicker through
    // the other's state for a moment while the pane is still settling, so
    // require the same outcome on two reads a beat apart before trusting it.
    const settled = () =>
      this.page
        .getByRole("button", { name: "Info" })
        .or(
          this.page.getByRole("heading", {
            name: /Enter your OpenAPI specification/,
          }),
        )
        .isVisible();
    await expect(async () => {
      expect(await settled()).toBe(true);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
    await this.page.waitForTimeout(300);
    await expect(async () => {
      expect(await settled()).toBe(true);
    }).toPass({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks the Tests tab, waiting for either the empty-state "New test
   * suite" button or the Test Suites list to render. Since INS-3528, this
   * tab only renders at all while Preferences -> General's "Enable legacy
   * unit tests" setting is on — callers should go through
   * `WorkspaceFlow.openTests()` rather than this directly, since it turns
   * that setting on first.
   */
  async openTestsTab(): Promise<void> {
    await this.page.getByRole("tab", { name: "Tests" }).click();
    await expect(this.page.locator(this.NEW_SUITE_BUTTON)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Clicks "Remove custom ruleset" and waits for the toolbar to revert to
   * the default OAS ruleset label.
   */
  async removeRuleset(): Promise<void> {
    await this.page.locator(this.REMOVE_RULESET_BUTTON).click();
    await this.page
      .getByRole("dialog")
      .getByRole("button", { name: "Remove", exact: true })
      .click();
    await expect(this.page.getByText(this.DEFAULT_RULESET_LABEL)).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Double-clicks the currently open suite's editable title, retypes it,
   * and confirms with Enter.
   * @param currentName - The suite's exact current name
   * @param newName - The name to give it
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
      this.page
        .locator(this.TEST_SUITES_LIST)
        .getByRole("row", { name: newName }),
    ).toBeVisible({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Double-clicks `currentName`'s editable title within the Unit tests
   * list, retypes it, and confirms with Enter.
   * @param currentName - The test's exact current name
   * @param newName - The name to give it
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
   * @param format - The spec format to select
   */
  async selectFormat(format: SpecFormat): Promise<void> {
    const formatButton = this.page.locator(this.FORMAT_BUTTON);
    await formatButton.click();
    await this.page.getByRole("menuitemradio", { name: format }).click();
    await expect(formatButton).toHaveText(format, { timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks `suiteName`'s row in the Test Suites sidebar, navigating into
   * it (a no-op if it's already the selected suite), and waits for it to
   * become the selected row.
   * @param suiteName - The exact name of the suite to select
   */
  async selectTestSuite(suiteName: string): Promise<void> {
    const row = this.page
      .locator(this.TEST_SUITES_LIST)
      .getByRole("row", { name: suiteName });
    await row.click();
    await expect(row).toHaveAttribute("aria-selected", "true", {
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Replaces the entire spec editor's content via CodeMirror's
   * `setValue()` API.
   * @param text - The full spec text to set
   */
  async setSpecification(text: string): Promise<void> {
    await this.setCodeMirrorValue(this.page.locator(this.SPEC_EDITOR), text);
    await this.page.waitForTimeout(1000);
  }

  /**
   * Clicks the docs-preview toggle, waiting for `.pane-two` to flip to the
   * opposite of its visibility beforehand.
   * @returns `true` if the docs preview pane is open after toggling, `false` if it's now hidden
   */
  async togglePreview(): Promise<boolean> {
    const wasOpen = await this.isPreviewOpen();
    await this.page.locator(this.PREVIEW_TOGGLE).click();
    await (wasOpen ? expect(this.page.locator(this.PANE_TWO)).toBeHidden({
        timeout: DEFAULT_TIMEOUT,
      }) : expect(this.page.locator(this.PANE_TWO)).toBeVisible({
        timeout: DEFAULT_TIMEOUT,
      }));
    return !wasOpen;
  }

  /**
   * Stubs the native file-open dialog to return `filePath`, then clicks
   * "Upload custom ruleset" and waits for either outcome to settle: the
   * "View selected ruleset content" button (ruleset accepted) or the
   * "Invalid Spectral Ruleset" error dialog (ruleset rejected). Dismiss
   * the error dialog afterward via `closeDialog()` — it's the app's shared
   * error modal, so no dedicated close method lives here.
   * @param filePath - Absolute path to the `.spectral.yaml` ruleset file to upload
   * @returns `"success"` if the ruleset was accepted, `"invalid"` if it was rejected
   */
  async uploadRuleset(filePath: string): Promise<"success" | "invalid"> {
    await this.stubFileChooser(filePath);
    await this.page.locator(this.UPLOAD_RULESET_BUTTON).click();

    const success = this.page.locator(this.VIEW_RULESET_BUTTON);
    const invalid = this.page.getByText("Invalid Spectral Ruleset", {
      exact: true,
    });
    await expect(success.or(invalid)).toBeVisible({ timeout: DEFAULT_TIMEOUT });
    return (await invalid.isVisible()) ? "invalid" : "success";
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
   * @param row - One `LINT_ENTRY_ROW` locator from the lint panel
   * @returns The parsed fields, or `undefined` if the row's text doesn't match the expected `"(N) code: description"` shape
   */
  private async getLintRowSummary(
    row: Locator,
  ): Promise<Omit<LintEntry, "lineRefs"> | undefined> {
    const header = row.locator("> button").first();
    const text = await header.innerText();
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

  private async poll<T>(
    fn: () => Promise<T | undefined>,
    timeout = 2000,
    interval = 200,
  ): Promise<T | undefined> {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      const result = await fn();
      if (result !== undefined) return result;
      await new Promise<void>((resolve) => setTimeout(resolve, interval));
    }
    return undefined;
  }

  private tab(name: string): Locator {
    return this.page.locator(this.TAB_ROW, { hasText: name });
  }

  private async tabName(row: Locator): Promise<string> {
    return (await row.locator('span[class*="mx-[8px]"]').innerText()).trim();
  }
}

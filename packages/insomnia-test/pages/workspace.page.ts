import { expect } from "@playwright/test";
import type { Locator, Page } from "playwright-core";

import { DropdownComponent } from "../components/dropdown.component";
import { SearchFieldComponent } from "../components/search-field.component";
import { TabBarComponent } from "../components/tab-bar.component";
import { TreeComponent } from "../components/tree.component";
import type { ContextMenuItem } from "../enums/context-menu-items";
import { HttpMethod } from "../enums/http-method";
import { LintSeverity } from "../enums/lint-severity";
import { ProjectType } from "../enums/project-types";
import { RulesetType } from "../enums/ruleset-type";
import type { SpecFormat } from "../enums/spec-format";
import { TreeNodeType } from "../enums/tree-node-types";
import { DEFAULT_TIMEOUT } from "../misc/constants";
import type {
  LintEntry,
  PathItem} from "../models/collection";
import {
  Info,
  License,
  Specification,
} from "../models/collection";
import { BasePage } from "./base.page";
import { NEW_PROJECT_BUTTON } from "./project.page";

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
  /** The sidebar item kind, from the row's `data-node-type`. */
  nodeType: string;
  /** The nesting parent's key, from the row's `data-parent-id`. */
  parentId?: string;
  /** The row's position among all visible rows, from `data-index`. */
  index: number;
}

export class Tree {
  readonly roots: TreeNode[];

  constructor(roots: TreeNode[]) {
    this.roots = roots;
  }

  /**
   * Scrapes the project navigation tree grid into a flat set of rows,
   * scrolling the container until no new rows appear and the bottom is
   * reached, then reconstructs the hierarchy from each row's
   * `data-parent-id`. This is needed because the tree is virtualized, so
   * not all nodes are in the DOM at once.
   */
  static async fromPage(page: Page): Promise<Tree> {
    const grid = page.getByRole("grid", { name: "Project Navigation Tree" });
    await expect(grid).toBeVisible({ timeout: DEFAULT_TIMEOUT });

    const scroller = page.getByTestId("project-navigation-tree-container");
    const rows = grid.locator("[data-node-type]");
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
          const nodeType = el.dataset.nodeType ?? "";
          const parentId = el.dataset.parentId || undefined;
          const index = Number.parseInt(el.dataset.index ?? "", 10) || 0;

          return { key, name, nodeType, parentId, index };
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
      // Let the virtualized list render the rows the scroll just exposed.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
    }

    return Tree.fromRows([...collected.values()]);
  }

  /**
   * Rebuilds the parent/child hierarchy from a flat list of tree rows by
   * sorting them into visual order and linking each row to the row whose
   * key is its `parentId`. A row whose parent is not in the list (e.g. a
   * project, whose parent is the organization) becomes a root. Pinned
   * requests are listed under the "Pinned" header row that precedes them,
   * not under their real parent.
   */
  static fromRows(rows: TreeRow[]): Tree {
    const ordered = [...rows].sort((a, b) => a.index - b.index);
    const nodes = new Map<string, TreeNode>();
    for (const row of ordered) {
      nodes.set(row.key, {
        _id: row.key,
        name: row.name,
        type: Tree.typeFromRow(row),
        children: [],
      });
    }

    const roots: TreeNode[] = [];
    let pinnedHeaderKey: string | undefined;
    for (const row of ordered) {
      if (row.nodeType === "pinnedHeader") pinnedHeaderKey = row.key;
      const parentKey =
        row.nodeType === "pinnedRequest" ? pinnedHeaderKey : row.parentId;
      const parent = parentKey ? nodes.get(parentKey) : undefined;
      (parent ? parent.children : roots).push(nodes.get(row.key)!);
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
   */
  private static async expandAllCollapsed(grid: Locator): Promise<void> {
    const collapsedWorkspaceRows = grid
      .locator('[data-node-type="workspace"]')
      .filter({ has: grid.page().locator('[data-expanded="false"]') });
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
        // A click can be swallowed when the tree re-renders right after it
        // (the row stays collapsed), so re-click until the toggle flips.
        await expect(async () => {
          if (!(await expandButton.isVisible())) return;
          await stableRow.scrollIntoViewIfNeeded({ timeout: DEFAULT_TIMEOUT });
          await expandButton.click({ timeout: DEFAULT_TIMEOUT });
          await expect(expandButton).toBeHidden({ timeout: DEFAULT_TIMEOUT });
        }).toPass({ timeout: DEFAULT_TIMEOUT });
      } catch (error) {
        throw new Error(`Failed to expand tree row "${key}"`, { cause: error });
      }
    }
  }

  private static typeFromRow(row: TreeRow): TreeNodeType {
    switch (row.nodeType) {
      case "project": {
        return TreeNodeType.Project;
      }
      case "workspace": {
        return TreeNodeType.Workspace;
      }
      case "emptyProject": {
        return TreeNodeType.Empty;
      }
      case "pinnedRequest": {
        return TreeNodeType.Request;
      }
      case "collectionChild": {
        // A collection child is a folder or a request; `data-node-type`
        // does not tell them apart, but a folder's id starts with "fld_".
        return row.key.startsWith("fld_")
          ? TreeNodeType.Folder
          : TreeNodeType.Request;
      }
      default: {
        return TreeNodeType.Unknown;
      }
    }
  }

  /**
   * Depth-first flattens the tree into a single array, useful for
   * searching across all nodes regardless of nesting.
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
  private readonly NEW_PROJECT_BUTTON: string = NEW_PROJECT_BUTTON;

  private readonly NEW_PROJECT_DIALOG =
    "[aria-label='Create or update dialog']";

  private readonly PROJECT_NAME: string = 'input[name="name"]';

  private readonly PROMPT_INPUT: string = 'input[id="prompt-input"]';

  /**
   * Opens the "+" add-tab menu and clicks "Add request to current
   * collection", creating a new HTTP request under the active tab's
   * collection and opening it as a new tab.
   */
  async addRequestToCurrentCollection(): Promise<void> {
    const rows = this.tabBar.rows;
    const before = await rows.count();
    await this.tabBar.openAddMenu();
    await this.page
      .getByRole("menuitem", { name: "Add request to current collection" })
      .click();
    await expect(rows).toHaveCount(before + 1, { timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Clicks the given tab, making it the active tab, and waits for the
   * route change to settle before returning.
   */
  async clickTab(name: string): Promise<void> {
    await this.tabBar.activate(name);
  }

  /**
   * Clicks a tab's close ("x") button.
   */
  async closeTab(name: string): Promise<void> {
    await this.tabBar.close(name);
  }

  /**
   * Reads back the currently active (selected) tab's name.
   */
  async getActiveTabName(): Promise<string | undefined> {
    return this.tabBar.activeName();
  }

  /**
   * Reads back this tab's method tag text (e.g. "GET"), for request
   * tabs.
   */
  async getTabMethodTag(name: string): Promise<string> {
    return this.tabBar.methodTag(name);
  }

  /**
   * Reads back the names of every currently open tab, in on-screen
   * (left-to-right) order.
   */
  async getTabNames(): Promise<string[]> {
    return this.tabBar.names();
  }

  /**
   * Checks whether a tab with the given name is currently open.
   */
  async isTabOpen(name: string): Promise<boolean> {
    return this.tabBar.isOpen(name);
  }

  /**
   * Double-clicks a temporary (italicized preview) tab to pin it, so
   * navigating to a different request reuses a new temporary tab instead
   * of replacing this one.
   */
  async pinTab(name: string): Promise<void> {
    await this.tabBar.pin(name);
  }

  /**
   * Opens the tab bar's "+" add-tab menu.
   */
  private async openAddTabMenu(): Promise<void> {
    await this.tabBar.openAddMenu();
  }

  /**
   * Locates a context-menu item by name, matching either a menuitem or a
   * menuitemradio role since some menu entries render as radio options.
   * Exposed (unlike `clickContextMenu`) so a caller can assert visibility
   * without clicking, e.g. confirming an item is offered on a given
   * surface.
   */
  getContextMenuItem(item: ContextMenuItem): Locator {
    // The context menu is portalled to the body, so any root works.
    return new DropdownComponent(this.page, this.page.locator("body")).item(
      item,
    );
  }

  /**
   * Clicks a context-menu item, matching either a menuitem or a
   * menuitemradio role since some menu entries render as radio options.
   */
  async clickContextMenu(item: ContextMenuItem): Promise<void> {
    await this.getContextMenuItem(item).click();
  }

  /**
   * Opens a workspace row's "⋮" actions dropdown (the "SideBar Workspace
   * Actions" trigger, only rendered on hover) — the same underlying menu
   * `rightClick()` also opens.
   */
  async openWorkspaceActionsDropdown(node: TreeNode): Promise<void> {
    const row = this.treeNav.containerRow(node._id);
    await row.scrollIntoViewIfNeeded();
    await row.hover();
    await row.getByLabel("SideBar Workspace Actions").click();
  }

  /**
   * Clicks the "Create" button and waits for the create/update dialog to
   * close.
   */
  async clickCreate(timeoutMs: number = DEFAULT_TIMEOUT): Promise<void> {
    const createButton = this.page.getByRole("button", {
      name: "Create",
      exact: true,
    });
    await createButton.click();
    await this.page
      .locator(this.NEW_PROJECT_DIALOG)
      .waitFor({ state: "hidden", timeout: timeoutMs });
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
    const deleteButton = dialog.getByRole("button", { name: /^Delete/ });
    // The dialog can re-render right as it opens, swallowing the first
    // click; press again while the button is still there.
    await expect(async () => {
      if (await deleteButton.isVisible()) await deleteButton.click({ timeout: 2000 });
      await expect(dialog).toBeHidden({ timeout: 3000 });
    }).toPass({ timeout: DEFAULT_TIMEOUT * 2 });
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
   * before returning — the snippet updates
   * asynchronously (~1s) after the menu item click, so a caller reading
   * `getGeneratedCode()` immediately after would race a stale snippet.
   * No-ops if `target` is already the dropdown's current selection.
   */
  async setGenerateCodeTarget(target: string): Promise<void> {
    const dropdown = this.generateCodeDialog.getByTestId(
      "generate-code-target-dropdown",
    );
    if ((await dropdown.innerText()).trim() === target) {
      return;
    }
    const before = await this.readCodeMirror(this.generateCodeCodeMirror);
    await dropdown.getByRole("button").click({ force: true });
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
   */
  async setGenerateCodeClient(client: string): Promise<void> {
    const dropdown = this.generateCodeDialog.getByTestId(
      "generate-code-client-dropdown",
    );
    if ((await dropdown.innerText()).trim() === client) {
      return;
    }
    const before = await this.readCodeMirror(this.generateCodeCodeMirror);
    await dropdown.getByRole("button").click({ force: true });
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
   * Scrolls a tree node's row into view and left-clicks it.
   */
  async clickNode(node: TreeNode): Promise<void> {
    await this.treeNav.clickByKey(node._id);
  }

  /**
   * Clicks a request's tree node and waits until its tab is the active
   * one. Without this, a request page's `navigate()` can resolve against
   * the previously open request's still-mounted editor, so a following
   * Send/Connect click acts on the wrong request.
   */
  async openRequestNode(node: TreeNode): Promise<void> {
    await this.clickNode(node);
    await this.tabBar.waitForSelectedKey(node._id);
  }

  /**
   * Focuses the given folder's row and presses the Right arrow key,
   * expanding it (a no-op if it's already expanded). Waits for the row's
   * "Collapse {name}" toggle to actually render before returning —
   * `project-navigation-sidebar.tsx`'s own arrow-key
   * handler flips this asynchronously (`toggleRequestGroups()` reads
   * `requestGroupMeta` via a DB round trip before patching the UI's query
   * cache), so the bare keypress can resolve tens of ms before the row's
   * expanded state actually changes.
   */
  async expand(node: TreeNode): Promise<void> {
    await this.treeNav.expandByKey(node._id, node.name);
  }

  /**
   * Focuses the given folder's row and presses the Left arrow key,
   * collapsing it (a no-op if it's already collapsed). See `expand()` for
   * why this waits for the toggle to settle rather than returning as soon
   * as the keypress itself resolves.
   */
  async collapse(node: TreeNode): Promise<void> {
    await this.treeNav.collapseByKey(node._id, node.name);
  }

  /**
   * Checks whether a folder node is currently expanded, via its own
   * "Collapse {name}" toggle button (only rendered while expanded — the
   * same convention `expandAllCollapsed()` reads for "Expand {name}").
   */
  async isExpanded(node: TreeNode): Promise<boolean> {
    return this.treeNav.isExpandedByKey(node._id, node.name);
  }

  /**
   * Clicks the given node to select it, then sends the platform's "show
   * create menu" shortcut (Cmd+N on macOS, Ctrl+N elsewhere), opening the
   * Sidebar Shortcut Create Menu targeted at that folder/collection/project.
   * The shortcut only opens the menu — it does not create
   * anything by itself, unlike `workspaceFlow.createCollection()`'s own "+"-button
   * dropdown path.
   */
  async openCreateShortcut(node: TreeNode): Promise<void> {
    await this.clickNode(node);
    // The click's own selection state (which the sidebar
    // syncs from an async route-resource fetch, not synchronously off the
    // click) can still be catching up when Ctrl+N fires. If that catch-up
    // lands *after* the shortcut menu opens, the sidebar's own "close the
    // dropdown when the selected item changes" effect fires against it and
    // silently closes the menu moments after this method returns. Waiting
    // for the row's own `aria-selected` to settle first lets that catch-up
    // (and its effect) happen before the menu ever opens, so it can't
    // close a menu that doesn't exist yet.
    await this.waitForSelectionSettled(node);
    // The shortcut listener is rebound on every render of the component
    // that owns it (see CommandPalettePage.openViaShortcut()'s doc comment
    // for the same race), so draining the renderer's task queue first
    // ensures the re-render `waitForSelectionSettled()` just waited out has
    // actually finished before the keypress is sent.
    await this.waitForRendererIdle();
    // The shortcut listener is bound to the sidebar container, not the
    // window, so the keypress must originate inside it. Pressing on the
    // row itself (like `expand()`) guarantees that, whereas
    // `page.keyboard.press()` goes to whatever holds focus — which can
    // have moved into the main pane after the click opened the item's tab.
    await this.treeNav.containerRow(node._id).press("ControlOrMeta+n");
    await expect(this.page.getByRole("menu")).toBeVisible({
      timeout: DEFAULT_TIMEOUT,
    });
  }

  /**
   * Polls a row's `aria-selected` attribute until it reports `"true"`
   * across two consecutive reads — see `openCreateShortcut()`'s doc
   * comment for the async selection catch-up this waits out.
   */
  private async waitForSelectionSettled(node: TreeNode): Promise<void> {
    await this.treeNav.waitForSelectedByKey(node._id);
  }

  /**
   * Checks whether the Sidebar Shortcut Create Menu (opened via
   * `openCreateShortcut()`) is currently visible.
   * Matching this popover's `role="menu"` by its own
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
   * Like `findItemNode()`, but for nodes that are expected to exist: waits
   * up to `DEFAULT_TIMEOUT` (a loaded CI runner can take well over the 2s
   * `findItemNode()` budget to render a new node) and throws naming the
   * node instead of returning `undefined`. Use `findItemNode()` to assert
   * a node is absent.
   * @throws If no matching node appears within `DEFAULT_TIMEOUT`
   */
  async requireItemNode(
    item: { id?: string; name: string },
    type?: TreeNodeType,
    parent?: TreeNode,
  ): Promise<TreeNode> {
    const node = await this.poll(
      () => this.findItemNode(item, type, parent),
      DEFAULT_TIMEOUT,
    );
    if (!node) {
      throw new Error(
        `Tree node not found within ${DEFAULT_TIMEOUT}ms: ${JSON.stringify({ ...item, type, parent: parent?.name })}`,
      );
    }
    return node;
  }

  /**
   * Polls the tree until a node matching the given name (and optional
   * type) appears, since newly created nodes may not render immediately.
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
   * both are the exact same entry point into the same
   * "New Workspace" naming dialog (there is no longer a separate "Document"
   * workspace type or creation path). Fills its placeholder-labeled name
   * input and commits by pressing Enter (the input sits inside a native
   * form, so Enter submits it) instead of clicking a "Create" button.
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
    await expect(this.sidebarFilter.root).toHaveValue("", {
      timeout: DEFAULT_TIMEOUT,
    });
    await this.waitForTreeSettled();
  }

  /**
   * Polls the navigation tree's currently-rendered rows until they stop
   * changing, i.e. a filter/clear/drop has finished re-rendering the
   * list. Only reads the rows already in the DOM — unlike `getTree()` it
   * neither scrolls nor expands anything.
   */
  async waitForTreeSettled(): Promise<void> {
    const rows = this.page
      .getByRole("grid", { name: "Project Navigation Tree" })
      .locator('div[role="row"][data-key]');
    await this.waitForStableValue(
      () => rows.evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.key)),
      4,
    );
  }

  private get tabBar(): TabBarComponent {
    return new TabBarComponent(this.page);
  }

  private get treeNav(): TreeComponent {
    return new TreeComponent(this.page);
  }

  private get sidebarFilter(): SearchFieldComponent {
    return SearchFieldComponent.byLabel(this.page, "Projects filter");
  }

  /**
   * Types into the sidebar's "Projects filter" search box, narrowing the
   * project/workspace/collection-child tree down to matching nodes.
   */
  async filterSidebar(text: string): Promise<void> {
    await this.sidebarFilter.search(text);
    await this.waitForTreeSettled();
  }

  /**
   * Checks whether a dialog with the given heading text is currently
   * open. Every simple modal in the app (Request/Collection Settings,
   * etc.) shares the same generic dialog role, so callers scope by
   * heading text to tell them apart.
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
   * context-menu "Rename" dialog `workspaceFlow.rename*()` drives.
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
   */
  async getRequestTypeLabel(node: TreeNode): Promise<string> {
    const row = this.treeNav.containerRow(node._id);
    const label = await row.getByTestId("node-type-label").innerText();
    return label.trim();
  }

  /**
   * Scrapes and reconstructs the current state of the project navigation
   * tree.
   */
  async getTree(): Promise<Tree> {
    return await Tree.fromPage(this.page);
  }

  /**
   * Determines the kind of workspace item a tree node represents by
   * inspecting its row icon.
   */
  /**
   * A legacy Document workspace still renders with its own
   * "file" icon in the tree even though it's functionally just a
   * Collection now — this doesn't distinguish that case, since nothing
   * branches on it anymore; both render as `"collection"`.
   */
  async getWorkspaceItemKind(
    node: TreeNode,
  ): Promise<"collection" | "mcpClient"> {
    const row = this.treeNav.containerRow(node._id);
    const icon = await row
      .getByTestId("node-type-icon")
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
   */
  async resolveNode(
    parent: TreeNode | { name: string; id?: string },
  ): Promise<TreeNode> {
    if ("_id" in parent) return parent as TreeNode;
    // findItemNode() only polls for 2s, which a slow sidebar re-render (e.g. after a Git Sync
    // commit) can exceed — give the parent node a full DEFAULT_TIMEOUT to show up.
    const node = await this.poll(() => this.findItemNode(parent), DEFAULT_TIMEOUT);
    if (!node) {
      throw new Error(`resolveNode(): no tree node found for ${JSON.stringify(parent)}`);
    }
    return node;
  }

  /**
   * Scrolls a tree node's row into view and right-clicks it to open its
   * context menu.
   */
  async rightClick(node: TreeNode): Promise<void> {
    const row = this.treeNav.containerRow(node._id);
    await row.scrollIntoViewIfNeeded();
    // A React Aria tooltip left open elsewhere in the tree (e.g. an
    // unsynced workspace node's "Click to fetch this file" hint) can
    // render above this row and intercept the click; Escape closes it
    // immediately instead of waiting out its hover close delay. Only do
    // this when a tooltip is actually open — an unconditional Escape can
    // instead dismiss an unrelated open dialog/panel (e.g. the
    // Environment Editor) and disrupt the tree this row lives in.
    await expect(async () => {
      if (await this.page.getByRole("tooltip").isVisible()) {
        await this.page.keyboard.press("Escape");
      }
      await row.click({ button: "right", timeout: 3000 });
    }).toPass({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Waits for a deleted node's row to actually disappear from the tree.
   * The delete confirmation dialog can close (and its promise resolve)
   * slightly before the underlying row is removed from the DOM, so a
   * `getNodes()`/`getTree()` read taken immediately after confirming a
   * delete can still briefly see the stale row.
   */
  async waitForNodeRemoved(node: TreeNode): Promise<void> {
    const row = this.treeNav.containerRow(node._id);
    await expect(row).toHaveCount(0, { timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Presses the mouse down on a tree node's row and nudges it a few
   * pixels, crossing react-aria's own drag-start threshold so the row
   * picks up `data-dragging="true"`. Leaves the mouse button held down —
   * pair with one or more `dragOver()` calls and a final `releaseDrag()`.
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
   */
  async getDropIndicator(): Promise<DropIndicator | undefined> {
    // dragOver()'s pointer moves are handled asynchronously (react-aria's
    // own drag-and-drop machinery resolves the hovered drop target off the
    // pointermove event, then re-renders the indicator a tick later), so
    // reading it back immediately can catch the DOM before that render has
    // happened. Draining the renderer's task queue first ensures it has.
    await this.waitForRendererIdle();
    const indicator = this.page.locator('[role="row"][data-drop-target]');
    if ((await indicator.count()) === 0) return undefined;

    const target = indicator.first();
    const folderBadge = target.getByTestId("drop-indicator-folder-name");
    const [ariaLabel, folderName] = await Promise.all([
      target
        .locator('[aria-roledescription="drop indicator"]')
        .getAttribute("aria-label"),
      (await folderBadge.count()) > 0 ? folderBadge.innerText() : "",
    ]);
    // react-aria labels an "on" drop "Drop on <name>"; line drops say
    // "Insert ...".
    const isValid =
      (await target.locator("[data-valid]").first().getAttribute("data-valid")) ===
      "true";
    const isInto = (ariaLabel ?? "").startsWith("Drop on");
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
   */
  private dragRow(node: TreeNode): Locator {
    return this.treeNav.containerRow(node._id);
  }

  /**
   * Right-clicks a tree node by name and clicks a context-menu item by
   * its visible label. Unlike clickContextMenu, the label isn't
   * restricted to the fixed ContextMenuItem enum, so this also covers
   * dynamically-labeled entries such as plugin-injected menu items.
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

    const menu = this.page.getByRole("menu");
    const menuItem = menu
      .getByRole("menuitem", { name: contextMenu })
      .or(menu.getByRole("menuitemradio", { name: contextMenu }))
      .or(menu.getByRole("menuitemcheckbox", { name: contextMenu }));
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
   */
  async setDuplicateName(name: string): Promise<void> {
    const input = this.page.getByRole("dialog").locator('input[name="name"]');
    await input.fill(name);
    await expect(input).toHaveValue(name);
  }

  /**
   * Fills the generic prompt input (used for naming new items such as
   * requests, folders, or documents).
   */
  async setItemName(value: string): Promise<void> {
    await this.page.locator(this.PROMPT_INPUT).fill(value);
  }

  /**
   * Fills the new item name prompt input and verifies the value stuck.
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
   */
  async setCollectionFileName(fileName: string): Promise<void> {
    const input = this.page.getByRole("textbox", { name: "File name" });
    await input.click();
    await input.press("ControlOrMeta+a");
    await input.fill(fileName);
  }

  /**
   * Waits until a parent node's first child is no longer the placeholder
   * "emptyCollection" row, i.e. a real child has been created, re-reading
   * the tree in a loop until that happens.
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

  /**
   * Selects a tree node's row, focuses the row itself (the shortcut ignores
   * inner controls) and presses the sidebar's Delete shortcut, opening the
   * node's delete confirmation dialog.
   */
  async pressDeleteShortcut(node: TreeNode): Promise<void> {
    const row = this.treeNav.containerRow(node._id);
    await row.scrollIntoViewIfNeeded();
    await row.click();
    await row.focus();
    await this.page.keyboard.press("Delete");
  }

  /**
   * Reads the titles of any visible "resource not found" toasts, so a failing
   * assertion names the route that raised it.
   */
  async getResourceNotFoundToastTexts(): Promise<string[]> {
    return this.page
      .getByTestId("toast-body")
      .filter({
        has: this.page
          .getByTestId("toast-description")
          .filter({
            hasText:
              "Please confirm that the resource still exists and has not been deleted or moved.",
          }),
      })
      .allInnerTexts();
  }

  /**
   * Counts the "resource not found" warning toasts currently on screen.
   */
  async countResourceNotFoundToasts(): Promise<number> {
    return this.page
      .getByText("Please confirm that the resource still exists and has not been deleted or moved.")
      .count();
  }
}

import { DropdownComponent } from "@package/components/dropdown.component";
import { ModalComponent } from "@package/components/modal.component";
import { SearchFieldComponent } from "@package/components/search-field.component";
import { TabBarComponent } from "@package/components/tab-bar.component";
import { TreeComponent } from "@package/components/tree.component";
import type { ContextMenuItem } from "@package/enums/context-menu-items";
import { TreeNodeType } from "@package/enums/tree-node-types";
import { DEFAULT_TIMEOUT, LONG_TIMEOUT, POLL_INTERVAL } from "@package/misc/constants";
import { expect } from "@playwright/test";
import type { Locator, Page } from "playwright-core";

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
   * key is its `parentId`. A row with no `parentId` (e.g. a project) or
   * whose parent is not in the list becomes a root.
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
    for (const row of ordered) {
      const parent = row.parentId ? nodes.get(row.parentId) : undefined;
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
        }).toPass({ timeout: LONG_TIMEOUT });
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
   * Like `findItemNode()`, but for nodes that are expected to exist: throws
   * naming the node instead of returning `undefined`. Use `findItemNode()`
   * to assert a node is absent.
   * @throws If no matching node appears within `DEFAULT_TIMEOUT`
   */
  async requireItemNode(
    item: { id?: string; name: string },
    type?: TreeNodeType,
    parent?: TreeNode,
  ): Promise<TreeNode> {
    const node = await this.findItemNode(item, type, parent);
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
    }, DEFAULT_TIMEOUT);
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
    }, DEFAULT_TIMEOUT);
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
    }, DEFAULT_TIMEOUT);
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
   * Scrapes and reconstructs the current state of the project navigation
   * tree.
   */
  async getTree(): Promise<Tree> {
    return await Tree.fromPage(this.page);
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
    const node = await this.findItemNode(parent);
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
   * Releases the mouse button, committing whichever drop target the last
   * `dragOver()` call left the indicator on.
   */
  async releaseDrag(): Promise<void> {
    await this.page.mouse.up();
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
    interval = POLL_INTERVAL,
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
   * Clicks the "Ok" button on the currently open dialog and waits for it
   * to close. Used to dismiss an error dialog (e.g. one surfaced by an
   * action decorated with `@throwOnDialog`) so a test can continue with
   * further steps afterward.
   */
  async closeDialog(): Promise<void> {
    const dialog = new ModalComponent(this.page).root;
    await dialog.getByRole("button", { name: "Ok" }).click();
    await expect(dialog).toBeHidden({ timeout: DEFAULT_TIMEOUT });
  }

  /**
   * Creates an API Collection via the project dashboard's empty-state
   * "Enter API Spec" button (only rendered when the project has no
   * workspaces yet) rather than the project-tree "API Collection" context
   * menu item. Fills the name input and commits by pressing Enter.
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
}

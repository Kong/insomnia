import { ContextMenuItem } from '@package/enums/context-menu-items';
import { LintSeverity } from '@package/enums/lint-severity';
import { ProjectType } from '@package/enums/project-types';
import { TreeNodeType } from '@package/enums/tree-node-types';
import { DEFAULT_TIMEOUT } from '@package/misc/constants';
import type { FlowContext } from '@package/misc/flow-context';
import { step } from "@package/misc/step";
import { Collection } from '@package/models/collection';
import { Environment } from '@package/models/environment';
import type { HttpRequest } from '@package/models/http-request';
import { Project } from '@package/models/project';
import type { PageManager } from '@package/pages/page-manager';
import { expect } from '@playwright/test';

import { BaseFlow } from './base.flow';
import type { PreferencesFlow } from './preferences.flow';

interface RequestLookup<T> {
  get(item: { name: string; id?: string }): Promise<T | undefined>;
}

/**
 * The per-protocol request flows `WorkspaceFlow` resolves tree nodes
 * through. `FlowManager` satisfies it structurally; depending on this shape
 * instead of `FlowManager` keeps the manager (which imports every flow)
 * from forming an import cycle with `WorkspaceFlow`.
 */
export interface RequestFlows {
  readonly httpRequestFlow: RequestLookup<HttpRequest>;
}

type RequestItem = HttpRequest;

export class WorkspaceFlow extends BaseFlow {
  constructor(
    context: FlowContext,
    pageManager: PageManager,
    private readonly preferencesFlow: PreferencesFlow,
    private readonly requestFlows: RequestFlows,
    private readonly gitRepoUrl?: string,
  ) {
    super(context, pageManager);
  }

  /**
   * Creates a new top-level Project through the create-project dialog.
   */
  @step()
  async createProject(item: Project): Promise<Project> {
    const workspace = this.pageManager.workspacePage;
    const projectPage = this.pageManager.projectPage;
    await projectPage.clickNewProject();
    await workspace.setNewItemName(item.name);
    await projectPage.setNewProjectType(item.type);
    // Project creation also provisions the project's NeDB records before
    // the dialog closes, which has been observed to run past the default
    // UI-only timeout under CI load — give it the same extra room as a
    // Git-backed collection's create dialog.
    await workspace.clickCreate(DEFAULT_TIMEOUT * 2);
    return this.assertCreated(await this.getProject(item.name), item.name);
  }

  /**
   * Creates a Collection under `parent`. If it carries a `spec`, authors
   * it into the spec editor right after creation and returns the fuller
   * `getCollectionSpec()` read instead of the plain `getCollection()` one.
   */
  @step()
  async createCollection(parent: Project, item: Collection, fileName?: string): Promise<Collection> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(parent);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.Collection);
    await workspace.setNewItemName(item.name);
    if (fileName !== undefined) {
      await workspace.setCollectionFileName(fileName);
    }
    // A file name means this collection is backed by its own file in a Git
    // Sync project, which writes and stages that file before the dialog
    // closes — give it more room than the default UI-only timeout.
    await workspace.clickCreate(fileName !== undefined ? DEFAULT_TIMEOUT * 2 : undefined);

    if (item.spec) {
      await this.authorSpec(item.name, item.spec);
      return this.assertCreated(await this.getCollectionSpec(item.name), item.name);
    }
    return this.assertCreated(await this.getCollection(item.name), item.name);
  }

  /**
   * Creates an Environment under `parent`.
   */
  @step()
  async createEnvironment(parent: Project, item: Pick<Environment, 'name'>): Promise<Environment> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(parent);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.Environment);
    await workspace.setNewItemName(item.name);
    await workspace.clickCreate();
    return this.assertCreated(await this.getEnvironment(item.name), item.name);
  }

  /**
   * Duplicates a request in place via its dedicated "Duplicate" dialog.
   */
  @step()
  async duplicateRequest(item: RequestItem, newName: string): Promise<{ id: string; name: string }> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(item);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.Duplicate);
    await workspace.setItemName(newName);
    await workspace.clickDuplicateRequest();
    const newNode = await workspace.findNode(newName, TreeNodeType.Request);
    return this.assertCreated(newNode ? { id: newNode._id, name: newName } : undefined, newName);
  }

  /**
   * Right-clicks the tree node matching `request` and pins it via the
   * context menu's "Pin" action.
   */
  @step()
  async pin(
    request: HttpRequest,
  ): Promise<void> {
    await this.togglePin(request, ContextMenuItem.Pin);
  }

  /**
   * Right-clicks the tree node matching `request` and unpins it via the
   * context menu's "Unpin" action.
   */
  @step()
  async unpin(
    request: HttpRequest,
  ): Promise<void> {
    await this.togglePin(request, ContextMenuItem.Unpin);
  }

  private async togglePin(
    request: HttpRequest,
    action: ContextMenuItem.Pin | ContextMenuItem.Unpin,
  ): Promise<void> {
    const { workspacePage } = this.pageManager;
    const pinned = await workspacePage.isPinned(request.name);
    if (pinned === (action === ContextMenuItem.Pin)) return;
    const node = await workspacePage.findItemNode(request);
    if (!node) throw new Error(`Failed to find "${request.name}" to pin`);
    await workspacePage.rightClick(node);
    await workspacePage.clickContextMenu(action);
  }

  // Project is deliberately not accepted, since its context menu has no
  // "Rename" entry — use `renameProject()` for that.

  /**
   * Finds the tree node matching `item` and returns it as a Collection
   * model. A lightweight read — just `id`/`name` — for a collection that
   * doesn't carry a spec; use `getCollectionSpec()` instead for one that
   * does (or might).
   */
  @step()
  async getCollection(item: string | { name: string; id?: string }): Promise<Collection | undefined> {
    const identity = typeof item === 'string' ? { name: item } : item;
    const node = await this.pageManager.workspacePage.findItemNode(identity);
    if (!node) return undefined;
    return Object.assign(new Collection(identity.name), { id: node._id });
  }

  /**
   * Finds a Collection by name/id and reads its spec, active ruleset
   * type, and OpenAPI version back, in addition to the plain
   * `getCollection()` fields — this is the read a spec-carrying
   * collection needs (what used to be a separate "Design Document" before
   * the two workspace types were unified). For the lint summary/codes,
   * call `getLintState()` separately — it polls for the lint pass to
   * settle, which not every caller needs.
   */
  @step()
  async getCollectionSpec(item: string | { name: string; id?: string }): Promise<Collection | undefined> {
    const identity = typeof item === 'string' ? { name: item } : item;
    const workspace = this.pageManager.workspacePage;
    const specPage = this.pageManager.specPage;

    const node = await workspace.findItemNode(identity);
    if (!node) return undefined;

    await workspace.clickNode(node);
    await specPage.navigate(node._id);

    const collection = new Collection(identity.name);
    collection.id = node._id;
    collection.specification = await specPage.getSpecification();
    collection.rulesetType = await specPage.getRulesetType();
    collection.version = await specPage.getOpenApiVersion();

    return collection;
  }

  /**
   * Creates a Collection under `parent` via the project dashboard's
   * empty-state "Enter API Spec" button (only rendered while `parent` has
   * no workspaces yet) instead of the project-tree "API Collection"
   * context menu — a different entry point into the same underlying
   * naming dialog. Authors `collection.spec` into the spec editor
   * afterward, if given.
   */
  @step()
  async createInEmptyState(parent: Project, collection: Collection): Promise<Collection> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(parent);
    await workspace.clickNode(node);
    await workspace.createCollectionInEmptyState(collection.name);

    if (collection.spec) {
      await this.authorSpec(collection.name, collection.spec);
      return this.assertCreated(await this.getCollectionSpec(collection.name), collection.name);
    }
    return this.assertCreated(await this.getCollection(collection.name), collection.name);
  }

  /**
   * Dismisses the currently open dialog (e.g. an error dialog surfaced by
   * an action decorated with `@throwOnDialog`) by clicking its "Ok"
   * button, so a test can continue with further steps afterward.
   */
  @step()
  async closeDialog(): Promise<void> {
    await this.pageManager.workspacePage.closeDialog();
  }

  /**
   * Types `spec` into an already-existing collection's spec editor,
   * replacing whatever content (if any) is currently there. Unlike the
   * `spec` passed to `create()` (which only authors right after
   * creation), this can be called at any later point — e.g. filling in a
   * collection that started out with no spec.
   */
  @step()
  async fillSpecification(item: Collection, spec: NonNullable<Collection['spec']>): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const specPage = this.pageManager.specPage;
    const node = await workspace.resolveNode(item);
    await workspace.clickNode(node);
    await specPage.navigate();
    await specPage.setSpecification(
      typeof spec === 'string'
        ? spec
        : JSON.stringify({
            swagger: '2.0',
            host: 'localhost',
            schemes: ['http'],
            info: spec.info,
            paths: spec.paths,
          }),
    );
  }

  /**
   * Expands the lint panel and polls the lint summary until it reports at
   * least `minLintErrors` errors — the lint pass reruns asynchronously after
   * `WorkspacePage.setSpecification()`, so a bare read right after can catch
   * a stale, lower count — then returns the settled lint summary and fired
   * rule codes. `getCollectionSpec()` doesn't call this itself (reading the
   * lint summary means waiting for it to settle, which not every caller
   * wants), so call it directly whenever you need the lint state — you're
   * already on the collection's page after `create()`/`getCollectionSpec()`/
   * `WorkspacePage.setSpecification()`.
   */
  @step()
  async getLintState(minLintErrors = 0): Promise<NonNullable<Collection['lint']>> {
    const workspace = this.pageManager.workspacePage;
    const specPage = this.pageManager.specPage;

    await specPage.expandLintPanel();
    await expect
      .poll(
        async () => {
          const summary = await specPage.getLintSummary();
          return summary === 'none' ? 0 : summary.errors;
        },
        { timeout: DEFAULT_TIMEOUT },
      )
      .toBeGreaterThanOrEqual(minLintErrors);
    // The summary and the entry rows update asynchronously as the lint pass
    // reruns, and the panel re-renders while results stream in (a row can
    // vanish mid-read). Re-read both together on every tick and only accept a
    // snapshot where they agree and that is unchanged since the previous tick,
    // so a stale summary can never be paired with settled rows.
    type LintState = NonNullable<Collection['lint']>;
    let settled: LintState | undefined;
    let previous = '';
    await expect
      .poll(
        async () => {
          try {
            const summary = await specPage.getLintSummary();
            const entries = await specPage.getLintEntries();
            const errors = summary === 'none' ? 0 : summary.errors;
            const warnings = summary === 'none' ? 0 : summary.warnings;
            const listedErrors = entries.filter(entry => entry.severity === LintSeverity.Error).length;
            const listedWarnings = entries.length - listedErrors;
            const snapshot = JSON.stringify({ errors, warnings, entries });
            const isStable = snapshot === previous;
            previous = snapshot;
            const agrees = errors === listedErrors && warnings === listedWarnings;
            if (isStable && agrees && errors >= minLintErrors) {
              settled = { errors, warnings, entries };
            }
            return settled !== undefined;
          } catch {
            previous = '';
            return false;
          }
        },
        { timeout: DEFAULT_TIMEOUT * 2, intervals: [500] },
      )
      .toBe(true);
    return settled!;
  }

  /**
   * Navigates to `item`'s page, then removes the active custom ruleset
   * via its confirm modal (`WorkspacePage.removeRuleset()`), reverting to
   * the default OAS ruleset.
   */
  @step()
  async removeRuleset(item: string | { name: string; id?: string }): Promise<void> {
    const identity = typeof item === 'string' ? { name: item } : item;
    const workspace = this.pageManager.workspacePage;
    const specPage = this.pageManager.specPage;

    const node = await workspace.findItemNode(identity);
    if (node) await workspace.clickNode(node);
    await specPage.navigate();
    await specPage.removeRuleset();
  }

  /**
   * Uploads a Spectral ruleset. If accepted, confirms it actually took
   * effect by polling the lint panel until `expectCode` appears among the
   * fired rules — bundling/re-linting happens asynchronously after the
   * "View selected ruleset content" button already shows, so a bare read
   * right after `WorkspacePage.uploadRuleset()` can catch a stale rule
   * list — and returns the settled rule list. If rejected, rejects with
   * the "Invalid Spectral Ruleset" error dialog's text (via
   * `@throwOnDialog`), leaving the default ruleset active and the dialog
   * open — dismiss it with `closeDialog()`.
   */
  @step()
  async uploadRuleset(filePath: string, expectCode?: string): Promise<string[]> {
    const specPage = this.pageManager.specPage;
    await this.context.stubFileChooser(filePath);
    await specPage.uploadRuleset();

    await specPage.expandLintPanel();
    if (expectCode) {
      await expect
        .poll(() => specPage.getLintEntryCodes(), {
          timeout: DEFAULT_TIMEOUT,
        })
        .toContain(expectCode);
    }
    return specPage.getLintEntryCodes();
  }

  /**
   * Types `spec` into `name`'s spec editor right after creation —
   * boilerplate-wrapped into Swagger 2.0 JSON when given as a
   * `Specification`, written verbatim otherwise (e.g. a hand-built
   * OpenAPI 3.0 payload).
   */
  private async authorSpec(name: string, spec: NonNullable<Collection['spec']>): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const specPage = this.pageManager.specPage;
    const node = await workspace.requireItemNode({ name });
    await workspace.clickNode(node);
    await specPage.navigate();
    await specPage.setSpecification(
      typeof spec === 'string'
        ? spec
        : JSON.stringify({
            swagger: '2.0',
            host: 'localhost',
            schemes: ['http'],
            info: spec.info,
            paths: spec.paths,
          }),
    );
  }

  private async getEnvironment(item: string | { name: string; id?: string }): Promise<Environment | undefined> {
    const identity = typeof item === 'string' ? { name: item } : item;
    const node = await this.pageManager.workspacePage.findItemNode(identity);
    if (!node) return undefined;
    return Object.assign(new Environment({ name: identity.name }), {
      id: node._id,
    });
  }

  /**
   * Finds the tree node matching `item` and returns it as a Project model.
   */
  @step()
  async getProject(item: string | { name: string; id?: string }): Promise<Project | undefined> {
    const identity = typeof item === 'string' ? { name: item } : item;
    const node = await this.pageManager.workspacePage.findItemNode(identity);
    if (!node) return undefined;
    return Object.assign(new Project(identity.name, ProjectType.Local), {
      id: node._id,
    });
  }
}

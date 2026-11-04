import { ContextMenuItem } from '@package/enums/context-menu-items';
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

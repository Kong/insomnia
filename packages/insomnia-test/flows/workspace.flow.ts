import { expect } from "@playwright/test";

import { ContextMenuItem } from "../enums/context-menu-items";
import { ProjectType } from "../enums/project-types";
import { TreeNodeType } from "../enums/tree-node-types";
import { DEFAULT_TIMEOUT } from "../misc/fixtures";
import { Collection, TestSuite, UnitTest } from "../models/collection";
import { Environment, isEnvironmentItem } from "../models/environment";
import type { EventStreamRequest } from "../models/event-stream-request";
import type { GitRepoConnection } from "../models/git-repo-connection";
import type { GraphQLRequest } from "../models/graphql-request";
import type { GrpcRequest } from "../models/grpc-request";
import type { HttpRequest } from "../models/http-request";
import { McpClient } from "../models/mcp-client";
import { Project } from "../models/project";
import type { RunnerOptions, RunnerRunResult } from "../models/runner";
import { Settings } from "../models/settings";
import type { SocketIORequest } from "../models/socket-io-request";
import type { WebSocketRequest } from "../models/websocket-request";
import type { PageManager } from "../pages/page-manager";
import type { TreeNode, UnitTestResultRow } from "../pages/workspace.page";
import { BaseFlow } from "./base.flow";
import type { FlowManager } from "./flow-manager";

export type WorkspaceItem =
  | (Project & { kind: "project" })
  | (Collection & { kind: "collection" })
  | (McpClient & { kind: "mcpClient" })
  | (HttpRequest & { kind: "http" })
  | (GraphQLRequest & { kind: "graphql" })
  | (GrpcRequest & { kind: "grpc" })
  | (EventStreamRequest & { kind: "eventStream" })
  | (SocketIORequest & { kind: "socketIO" })
  | (WebSocketRequest & { kind: "webSocket" });

/** The settled outcome of `WorkspaceFlow.runAllTests()`. */
export interface UnitTestRunResult {
  summary: string;
  rows: UnitTestResultRow[];
}

export class WorkspaceFlow extends BaseFlow {
  /**
   * @param flowManager - The owning FlowManager
   * @param pageManager - The shared PageManager
   * @param gitRepoUrl - The default repo URL to clone from when creating a Git Sync project without an explicit `repo.uri`; injected by the `git-fixtures` `user` fixture
   */
  constructor(
    flowManager: FlowManager,
    pageManager: PageManager,
    private readonly gitRepoUrl?: string,
  ) {
    super(flowManager, pageManager);
  }

  /**
   * Creates a new top-level Project. If `item.folderPath` is set (only
   * meaningful for `ProjectType.Git`), adopts that existing local folder
   * as the project's git repo (running `git init` inside it if it isn't
   * already one) via the create-project dialog's "Open local folder" mode,
   * instead of creating a fresh one.
   * @param item - The Project to create
   * @returns The created Project, with `id` populated
   */
  async create(item: Project): Promise<Project>;
  /**
   * Creates a Collection under `parent`. If it carries a `spec`, authors
   * it into the spec editor right after creation and returns the fuller
   * `getCollectionSpec()` read instead of the plain `getCollection()` one.
   * @param parent - The Project to create `item` under
   * @param item - The Collection to create
   * @param fileName - An explicit on-disk file name (without extension),
   * decoupled from `item.name` — only meaningful for Git Sync projects,
   * where each collection is backed by its own file
   * @returns The created Collection, with `id` populated
   */
  async create(
    parent: Project,
    item: Collection,
    fileName?: string,
  ): Promise<Collection>;
  /**
   * Creates an McpClient under `parent`.
   * @param parent - The Project to create `item` under
   * @param item - The McpClient to create
   * @returns The created McpClient, with `id` populated
   */
  async create(parent: Project, item: McpClient): Promise<McpClient>;
  /**
   * Creates an Environment under `parent`.
   * @param parent - The Project to create `item` under
   * @param item - The Environment to create
   * @returns The created Environment, with `id` populated
   */
  async create(parent: Project, item: Environment): Promise<Environment>;
  /**
   * Creates `item` (a Collection, McpClient, or Environment) under
   * `parent`. If `item` is a Collection carrying a `spec`, authors it into
   * the spec editor right after creation and returns the fuller
   * `getCollectionSpec()` read instead of the plain `getCollection()` one.
   * @param parent - The Project to create `item` under
   * @param item - The Collection, McpClient, or Environment to create
   * @returns The created item, with `id` populated
   */
  async create(
    parent: Project,
    item: Collection | McpClient | Environment,
  ): Promise<Collection | McpClient | Environment>;
  /**
   * Creates a new Git Sync Project by cloning a remote repo, explicitly
   * selecting `credentialName` (a credential already configured in
   * Preferences -> Credentials) rather than relying on whichever
   * credential the form defaults to.
   * @param item - The Project to create (type must be ProjectType.Git)
   * @param credentialName - The display name of the credential to use, e.g. "Custom Git Credential"
   * @param repo - Overrides for the repo to clone; `uri` defaults to the injected `gitRepoUrl`, `branch` defaults to "master"
   * @returns The created Project, with `id` populated
   */
  async create(
    item: Project,
    credentialName: string,
    // eslint-disable-next-line @typescript-eslint/unified-signatures -- kept separate from the plain `create(item: Project)` overload above: distinct JSDoc for the git-clone call shape
    repo?: Partial<GitRepoConnection>,
  ): Promise<Project>;
  /**
   * Creates `parentOrItem` as a Project when called with a single argument,
   * clones it as a Git Sync Project when the second argument is a
   * credential name string, or creates `item` (a Collection, McpClient, or
   * Environment) under `parentOrItem` as its parent Project otherwise —
   * dispatching to the matching private creation helper based on argument
   * types. `third` is only meaningful alongside a Collection (its on-disk
   * file name) or a credential name (repo overrides).
   * @param parentOrItem - The Project to create, or the parent Project to create `item` under
   * @param itemOrCredentialName - The Collection, McpClient, or Environment to create under `parentOrItem`; or a credential display name to clone `parentOrItem` as a Git Sync project
   * @param fileNameOrRepo - The Collection's on-disk file name (without extension); or repo overrides when cloning
   * @returns The created item, with `id` populated
   */
  async create(
    parentOrItem: Project,
    itemOrCredentialName?: Collection | McpClient | Environment | string,
    fileNameOrRepo?: string | Partial<GitRepoConnection>,
  ): Promise<Project | Collection | McpClient | Environment> {
    if (itemOrCredentialName === undefined) {
      const p = parentOrItem;
      await (p.folderPath !== undefined ? this.openFolder(p) : this.createProject(p));
      return this.assertCreated(await this.getProject(p.name), p.name);
    }
    if (typeof itemOrCredentialName === "string") {
      return this.cloneFromRemote(
        parentOrItem,
        itemOrCredentialName,
        fileNameOrRepo as Partial<GitRepoConnection> | undefined,
      );
    }
    const parent = parentOrItem;
    const item = itemOrCredentialName;
    const fileName = fileNameOrRepo as string | undefined;
    if (item instanceof McpClient) {
      await this.createMcpClient(parent, item.name);
      return this.assertCreated(await this.getMcpClient(item.name), item.name);
    }
    if (isEnvironmentItem(item)) {
      await this.createEnvironment(parent, item.name);
      return this.assertCreated(
        await this.getEnvironment(item.name),
        item.name,
      );
    }
    const collection = item as Collection;
    await this.createCollection(parent, collection.name, fileName);
    if (collection.spec) {
      await this.authorSpec(collection.name, collection.spec);
      return this.assertCreated(
        await this.getCollectionSpec(collection.name),
        collection.name,
      );
    }
    return this.assertCreated(
      await this.getCollection(collection.name),
      collection.name,
    );
  }

  /**
   * Creates a Collection under `parent` via the project dashboard's
   * empty-state "Enter API Spec" button (only rendered while `parent` has
   * no workspaces yet) instead of the project-tree "API Collection"
   * context menu — a different entry point into the same underlying
   * naming dialog. Authors `collection.spec` into the spec editor
   * afterward, if given.
   * @param parent - The Project to create the collection in (must currently be empty)
   * @param collection - The collection to create, with an optional `spec` to author
   * @returns The created collection, re-fetched via `getCollectionSpec()`/`getCollection()`
   */
  async createInEmptyState(
    parent: Project,
    collection: Collection,
  ): Promise<Collection> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(parent);
    await workspace.clickNode(node);
    await workspace.createCollectionInEmptyState(collection.name);

    if (collection.spec) {
      await this.authorSpec(collection.name, collection.spec);
      return this.assertCreated(
        await this.getCollectionSpec(collection.name),
        collection.name,
      );
    }
    return this.assertCreated(
      await this.getCollection(collection.name),
      collection.name,
    );
  }

  /**
   * Dismisses the currently open dialog (e.g. an error dialog surfaced by
   * an action decorated with `@throwOnDialog`) by clicking its "Ok"
   * button, so a test can continue with further steps afterward.
   */
  async closeDialog(): Promise<void> {
    await this.pageManager.workspacePage.closeDialog();
  }

  /**
   * Reads whether the one-time "Welcome to focus mode" onboarding popover
   * is currently shown, then dismisses it if so.
   * @returns Whether the popover was shown before being dismissed
   */
  async dismissFocusModePrompt(): Promise<boolean> {
    const { workspacePage } = this.pageManager;
    const shown = await workspacePage.isFocusModePromptShown();
    if (shown) await workspacePage.dismissFocusModePrompt();
    return shown;
  }

  /**
   * Opens `project`'s Settings dialog via its context menu's "Settings"
   * action and waits for it to load, leaving it open for further
   * interaction via `pageManager.projectSettingsPage` (e.g. reading the
   * current git repo path, relocating it).
   * @param project - The Project whose Settings dialog to open
   */
  async openSettings(project: Project): Promise<void> {
    const { workspacePage, projectSettingsPage } = this.pageManager;
    const node = await workspacePage.resolveNode(project);
    await workspacePage.rightClick(node);
    await workspacePage.clickContextMenu(ContextMenuItem.Settings);
    await projectSettingsPage.navigate();
  }

  /**
   * Renames `project` via its Settings dialog's "Project name" field —
   * Project has no "Rename" context-menu item, so this is the only way
   * to rename one.
   * @param project - The Project to rename
   * @param newName - The name to give it
   * @returns `project` with `name` updated
   */
  async renameProject(project: Project, newName: string): Promise<Project> {
    const { projectSettingsPage } = this.pageManager;
    await this.openSettings(project);
    await projectSettingsPage.setName(newName);
    await projectSettingsPage.clickUpdate();
    const renamed = new Project(newName, project.type);
    renamed.id = project.id;
    return renamed;
  }

  /**
   * Right-clicks the tree node matching `item` and deletes it via the
   * context menu. Does nothing if no matching node is found.
   * @param item - The workspace item or request to delete
   */
  async delete(
    item:
      | Project
      | Collection
      | McpClient
      | Environment
      | HttpRequest
      | GraphQLRequest
      | GrpcRequest
      | EventStreamRequest
      | SocketIORequest
      | WebSocketRequest,
  ): Promise<void> {
    const node = await this.pageManager.workspacePage.findItemNode(item);
    if (!node) return;
    await this.pageManager.workspacePage.rightClick(node);
    await this.pageManager.workspacePage.clickContextMenu(
      ContextMenuItem.Delete,
    );
    await this.pageManager.workspacePage.clickDelete();
    await this.pageManager.workspacePage.waitForNodeRemoved(node);
  }

  /**
   * Opens the command palette, searches for `query`, and reads back the
   * matching result names.
   * @param query - The search text to type
   * @returns The visible result names, in on-screen order
   */
  async search(query: string): Promise<string[]> {
    const { commandPalettePage } = this.pageManager;
    await commandPalettePage.open();
    await commandPalettePage.search(query);
    return commandPalettePage.getResultNames();
  }

  /**
   * Right-clicks the tree node matching `request` and reads back the
   * generated code snippet via "Generate Code" — available for regular
   * requests, not gRPC.
   * @param request - The request to generate a code snippet for
   * @param options - Optionally switch the dialog's target language
   * and/or client library before reading the snippet back (defaults to
   * Shell/cURL, whatever the dialog itself opens with)
   * @returns The generated code snippet's text (curl by default)
   */
  async generateCode(
    request:
      | HttpRequest
      | GraphQLRequest
      | EventStreamRequest
      | SocketIORequest
      | WebSocketRequest,
    options?: { target?: string; client?: string },
  ): Promise<string> {
    const { workspacePage } = this.pageManager;
    const node = await workspacePage.findItemNode(request);
    if (!node)
      throw new Error(`Failed to find "${request.name}" to generate code for`);
    await workspacePage.rightClick(node);
    await workspacePage.clickContextMenu(ContextMenuItem.GenerateCode);
    if (options?.target)
      await workspacePage.setGenerateCodeTarget(options.target);
    if (options?.client)
      await workspacePage.setGenerateCodeClient(options.client);
    return workspacePage.getGeneratedCode();
  }

  /**
   * Renames `item` via its context menu's "Duplicate" action, optionally
   * moving it into `targetProject`, then re-fetches it as its full model.
   * @param item - The Collection, McpClient, or Environment to duplicate
   * @param newName - The name to give the duplicated item
   * @param targetProject - An optional Project to duplicate the item into
   * @returns The duplicated item
   */
  async duplicate(
    item: Collection | McpClient | Environment,
    newName: string,
    targetProject?: Project,
  ): Promise<Collection | McpClient | Environment>;
  /**
   * Duplicates a request in place via its dedicated "Duplicate" dialog.
   * @param item - The request to duplicate
   * @param newName - The name to give the duplicated request
   * @returns The duplicated request's id and name
   */
  async duplicate(
    item:
      | HttpRequest
      | GraphQLRequest
      | GrpcRequest
      | EventStreamRequest
      | SocketIORequest
      | WebSocketRequest,
    newName: string,
  ): Promise<{ id: string; name: string }>;
  /**
   * Duplicates a workspace item via its context menu. Requests are
   * duplicated in place through a dedicated dialog and returned as a plain
   * `{ id, name }` pair; all other item types are renamed (and optionally
   * moved into `targetProject`) then re-fetched as their full model.
   * @param item - The Collection, McpClient, Environment, or request to duplicate
   * @param newName - The name to give the duplicated item
   * @param targetProject - An optional Project to duplicate the item into (ignored for requests)
   * @returns The duplicated item, or `{ id, name }` when `item` is a request
   */
  async duplicate(
    item:
      | Collection
      | McpClient
      | Environment
      | HttpRequest
      | GraphQLRequest
      | GrpcRequest
      | EventStreamRequest
      | SocketIORequest
      | WebSocketRequest,
    newName: string,
    targetProject?: Project,
  ): Promise<Collection | McpClient | Environment | { id: string; name: string }> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(item);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.Duplicate);

    if (node.type === TreeNodeType.Request) {
      await workspace.setItemName(newName);
      await workspace.clickDuplicateRequest();
      const newNode = await workspace.findNode(newName, TreeNodeType.Request);
      return this.assertCreated(
        newNode ? { id: newNode._id, name: newName } : undefined,
        newName,
      );
    }

    await workspace.setDuplicateName(newName);
    await workspace.selectDuplicateProject(targetProject?.name);
    await workspace.clickDuplicate();

    if (item instanceof Collection) {
      return this.assertCreated(await this.getCollection(newName), newName);
    }
    if (item instanceof McpClient) {
      return this.assertCreated(await this.getMcpClient(newName), newName);
    }

    // Duplicating only renames the copy's project-tree title; its inner
    // Base Environment document still carries the source environment's
    // original name, so it must be renamed separately to keep both in
    // sync — mirroring createBaseEnvironment()'s own rename step — and to
    // populate `containerName` the way environmentFlow.create() does.
    if (item.name !== newName) {
      await this.pageManager.environmentPage.navigate();
      await this.pageManager.environmentPage.renameEnvironment(
        item.name,
        newName,
      );
    }
    const duplicated = await this.assertCreated(
      await this.getEnvironment(newName),
      newName,
    );
    return Object.assign(duplicated, { containerName: newName });
  }

  /**
   * Right-clicks the tree node matching `request` and toggles its pinned
   * state via the context menu's "Pin" action.
   * @param request - The request to pin or unpin
   */
  async pin(
    request:
      | HttpRequest
      | GraphQLRequest
      | GrpcRequest
      | EventStreamRequest
      | SocketIORequest
      | WebSocketRequest,
  ): Promise<void> {
    const { workspacePage } = this.pageManager;
    const node = await workspacePage.findItemNode(request);
    if (!node) throw new Error(`Failed to find "${request.name}" to pin`);
    await workspacePage.rightClick(node);
    await workspacePage.clickContextMenu(ContextMenuItem.Pin);
  }

  /**
   * Renames a Collection, McpClient, or Environment via its context
   * menu's "Rename" action, then re-fetches it as its full model under
   * the new name.
   * @param item - The Collection, McpClient, or Environment to rename
   * @param newName - The name to give it
   * @returns The renamed item, re-fetched under `newName`
   */
  async rename(
    item: Collection | McpClient | Environment,
    newName: string,
  ): Promise<Collection | McpClient | Environment>;
  /**
   * Renames a request in place via its context menu's "Rename" action.
   * @param item - The request to rename
   * @param newName - The name to give it
   * @returns The renamed request's id and name
   */
  async rename(
    item:
      | HttpRequest
      | GraphQLRequest
      | GrpcRequest
      | EventStreamRequest
      | SocketIORequest
      | WebSocketRequest,
    newName: string,
  ): Promise<{ id: string; name: string }>;
  /**
   * Renames a workspace item via its context menu's "Rename" action —
   * Project is deliberately not accepted, since its context menu has no
   * "Rename" entry. Requests are re-fetched as a plain `{ id, name }` pair;
   * every other item type is re-fetched as its full model.
   * @param item - The Collection, McpClient, Environment, or request to rename
   * @param newName - The name to give it
   * @returns The renamed item, or `{ id, name }` when `item` is a request
   */
  async rename(
    item:
      | Collection
      | McpClient
      | Environment
      | HttpRequest
      | GraphQLRequest
      | GrpcRequest
      | EventStreamRequest
      | SocketIORequest
      | WebSocketRequest,
    newName: string,
  ): Promise<Collection | McpClient | Environment | { id: string; name: string }> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(item);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.Rename);
    await workspace.setItemName(newName);
    await workspace.clickRename();

    if (node.type === TreeNodeType.Request) {
      const newNode = await workspace.findNode(newName, TreeNodeType.Request);
      return this.assertCreated(
        newNode ? { id: newNode._id, name: newName } : undefined,
        newName,
      );
    }

    if (item instanceof Collection) {
      return this.assertCreated(await this.getCollection(newName), newName);
    }
    if (item instanceof McpClient) {
      return this.assertCreated(await this.getMcpClient(newName), newName);
    }

    return this.assertCreated(await this.getEnvironment(newName), newName);
  }

  /**
   * Right-clicks `collection` and opens its Runner via the "Run API
   * Collection" context-menu action, then applies whichever `options`
   * fields are defined. Leaves the Runner configured but does not click
   * "Run" — use this instead of `run()` when a test needs to interact
   * with the Runner (e.g. Cancel/Skip) while it's in flight, rather than
   * waiting for it to finish.
   * @param collection - The Collection to run
   * @param options - Iterations/delay/keep-logs/bail settings to apply before running
   */
  async openRunner(
    collection: Collection,
    options?: RunnerOptions,
  ): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const runner = this.pageManager.runnerPage;
    const node = await workspace.resolveNode(collection);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.RunCollection);
    await runner.navigate();

    if (options?.keepLogs !== undefined)
      await runner.setKeepLogs(options.keepLogs);
    if (options?.bail !== undefined) await runner.setBail(options.bail);
    if (options?.dataFilePath !== undefined) {
      await runner.uploadData(options.dataFilePath);
    }
    if (options?.iterations !== undefined) {
      await runner.setIterations(options.iterations);
    }
    if (options?.delay !== undefined) await runner.setDelay(options.delay);
  }

  /**
   * Opens the Runner via `openRunner()`, clicks "Run", and waits until
   * every configured iteration has produced a result for every selected
   * request before returning the collected test-result count and
   * per-iteration results.
   * @param collection - The Collection to run
   * @param options - Iterations/delay/keep-logs/bail settings to apply before running
   * @returns The pass/total test-result count and every iteration's per-request
   * results, scraped once per All/Passed/Failed/Skipped filter — note that since
   * those filters only toggle a request's nested test-assertion detail (not
   * whether the request's own result row appears), each filter's array has the
   * same request rows; only their per-assertion detail differs
   */
  async run(
    collection: Collection,
    options?: RunnerOptions,
  ): Promise<RunnerRunResult> {
    const runner = this.pageManager.runnerPage;
    await this.openRunner(collection, options);

    await runner.switchRequestTab("request-order");
    const selectedRequestCount = (await runner.getRequestOrder()).filter(
      (item) => item.selected,
    ).length;
    const targetIterations = await runner.getIterations();

    await runner.clickRun();

    await expect
      .poll(
        async () => {
          const results = await runner.getIterationResults();
          return (
            results.length === targetIterations &&
            results.every((it) => it.results.length === selectedRequestCount)
          );
        },
        { timeout: DEFAULT_TIMEOUT },
      )
      .toBe(true);

    return {
      testResultCount: await runner.getTestResultCount(),
      iterationResults: await runner.getIterationResultsByFilter(),
    };
  }

  /**
   * Resolves any workspace item (project, collection, MCP client, or any
   * request type) matching `item`, optionally scoped to a parent Project
   * or Collection node, and tags the result with a `kind` discriminant
   * identifying its concrete type.
   * @param item - The item name, or an object with name and optional id to match
   * @param parent - An optional Project or Collection to scope the lookup within
   * @returns The resolved item cast to `T`, or undefined if no matching node exists
   */
  async get<T = WorkspaceItem>(
    item: string | { name: string; id?: string },
    parent?: Project | Collection,
  ): Promise<T | undefined> {
    const identity = typeof item === "string" ? { name: item } : item;
    const workspace = this.pageManager.workspacePage;
    const parentNode = parent ? await workspace.resolveNode(parent) : undefined;
    const node = await workspace.findItemNode(identity, undefined, parentNode);
    const result = node
      ? await this.getResolved(node, { name: node.name, id: node._id })
      : undefined;
    return result as T | undefined;
  }

  /**
   * Opens the command palette, searches for `item`'s name, selects the
   * first matching result (navigating to it), then resolves it the same
   * way `get()` does.
   * @param item - The item name, or an object with name and optional id to match
   * @returns The resolved item cast to `T`, or undefined if no matching node exists
   */
  async getByPalette<T = WorkspaceItem>(name: string): Promise<T | undefined> {
    const { commandPalettePage } = this.pageManager;
    await commandPalettePage.open();
    await commandPalettePage.search(name);
    await commandPalettePage.selectResult(name);
    return this.get<T>(name);
  }

  /**
   * Finds the tree node matching `item` and returns it as a Collection
   * model. A lightweight read — just `id`/`name` — for a collection that
   * doesn't carry a spec; use `getCollectionSpec()` instead for one that
   * does (or might).
   * @param item - The collection name, or an object with name and optional id to match
   * @returns The matching Collection with `id` populated, or undefined if not found
   */
  async getCollection(
    item: string | { name: string; id?: string },
  ): Promise<Collection | undefined> {
    const identity = typeof item === "string" ? { name: item } : item;
    const node = await this.pageManager.workspacePage.findItemNode(identity);
    if (!node) return undefined;
    return Object.assign(new Collection(identity.name), { id: node._id });
  }

  /**
   * Finds a Collection by name/id and reads its spec, active ruleset
   * type, and OpenAPI version back, in addition to the plain
   * `getCollection()` fields — this is the read a spec-carrying
   * collection needs (what used to be a separate "Design Document" before
   * INS-3528 unified the two workspace types). For the lint summary/codes,
   * call `getLintState()` separately — it polls for the lint pass to
   * settle, which not every caller needs.
   * @param item - The collection's name, or an object with `name`/`id`
   * @returns The found collection (with `specification`/`rulesetType`/`version` populated), or `undefined` if not found
   */
  async getCollectionSpec(
    item: string | { name: string; id?: string },
  ): Promise<Collection | undefined> {
    const identity = typeof item === "string" ? { name: item } : item;
    const workspace = this.pageManager.workspacePage;

    const node = await workspace.findItemNode(identity);
    if (!node) return undefined;

    await workspace.clickNode(node);
    await workspace.navigateSpec();

    const collection = new Collection(identity.name);
    collection.id = node._id;
    collection.specification = await workspace.getSpecification();
    collection.rulesetType = await workspace.getRulesetType();
    collection.version = await workspace.getOpenApiVersion();

    return collection;
  }

  /**
   * Opens `item`'s Tests tab, then creates a default-named test suite (via
   * `WorkspacePage.createTestSuite()`, which also navigates into it) and
   * renames it — the two nearly always happen together, since a fresh
   * suite is always named "New Suite".
   * @param item - The collection's name, or an object with `name`/`id`
   * @param name - The name to give the new suite
   */
  async createTestSuite(
    item: string | { name: string; id?: string },
    name: string,
  ): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    await this.openTests(item);
    await workspace.createTestSuite();
    await workspace.renameTestSuite("New Suite", name);
  }

  /**
   * Opens `testSuite`'s Tests tab, selects `testSuite`, then creates a
   * default-named test (via `WorkspacePage.createTest()`) and renames it —
   * the two nearly always happen together, since a fresh test is always
   * named "Returns 200".
   * @param testSuite - The suite to add the test to
   * @param testName - The name to give the new test
   */
  async createUnitTest(testSuite: TestSuite, testName: string): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    await this.openTests(testSuite.collection);
    await workspace.selectTestSuite(testSuite.name);

    await workspace.createTest();
    await workspace.renameUnitTest("Returns 200", testName);
  }

  /**
   * Opens `item`'s Tests tab, then deletes `suiteName`'s test suite via its
   * confirm modal (`WorkspacePage.deleteTestSuite()`).
   * @param item - The collection's name, or an object with `name`/`id`
   * @param suiteName - The exact name of the suite to delete
   */
  async deleteTestSuite(
    item: string | { name: string; id?: string },
    suiteName: string,
  ): Promise<void> {
    await this.openTests(item);
    await this.pageManager.workspacePage.deleteTestSuite(suiteName);
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
   * @param minLintErrors - The minimum error count to wait for before reading the settled lint state; leave at 0 when no errors are expected
   * @returns The settled lint summary and fired rule codes
   */
  async getLintState(
    minLintErrors = 0,
  ): Promise<NonNullable<Collection["lint"]>> {
    const workspace = this.pageManager.workspacePage;

    await workspace.expandLintPanel();
    await expect
      .poll(
        async () => {
          const summary = await workspace.getLintSummary();
          return summary === "none" ? 0 : summary.errors;
        },
        { timeout: DEFAULT_TIMEOUT },
      )
      .toBeGreaterThanOrEqual(minLintErrors);
    const summary = await workspace.getLintSummary();
    const entries = await workspace.getLintEntries();
    return {
      errors: summary === "none" ? 0 : summary.errors,
      warnings: summary === "none" ? 0 : summary.warnings,
      entries,
    };
  }

  /**
   * Opens `item`'s Tests tab, selects `testSuiteName`, and reads it
   * back — its name (`WorkspacePage.getSelectedTestSuiteName()`) together
   * with every unit test currently listed under it
   * (`WorkspacePage.getUnitTestNames()`) and a reference back to `item`,
   * so the suite can be traced back to where it lives.
   * @param item - The collection's name, an object with `name`/`id`, or an already-resolved `Collection` (reused as-is, so any `specification`/`spec`/`lint` it already carries stays attached)
   * @param testSuiteName - The exact name of the suite to select and read
   * @returns The selected suite, with its unit tests and source collection populated
   */
  async getTestSuite(
    item: string | { name: string; id?: string },
    testSuiteName: string,
  ): Promise<TestSuite> {
    const workspace = this.pageManager.workspacePage;
    const node = await this.openTests(item);
    await workspace.selectTestSuite(testSuiteName);

    const collection =
      item instanceof Collection
        ? item
        : new Collection(typeof item === "string" ? item : item.name);
    if (!collection.id && node) collection.id = node._id;

    const name = await workspace.getSelectedTestSuiteName();
    const tests = (await workspace.getUnitTestNames()).map(
      (testName) => new UnitTest(testName),
    );
    return new TestSuite(name, tests, collection);
  }

  /**
   * Opens `item`'s Tests tab and reads back every suite name currently
   * listed in the Test Suites sidebar (`WorkspacePage.getTestSuiteNames()`).
   * @param item - The collection's name, or an object with `name`/`id`
   */
  async getTestSuiteNames(
    item: string | { name: string; id?: string },
  ): Promise<string[]> {
    await this.openTests(item);
    return this.pageManager.workspacePage.getTestSuiteNames();
  }

  /**
   * Navigates to `item`'s page, then removes the active custom ruleset
   * via its confirm modal (`WorkspacePage.removeRuleset()`), reverting to
   * the default OAS ruleset.
   * @param item - The collection's name, or an object with `name`/`id`
   */
  async removeRuleset(
    item: string | { name: string; id?: string },
  ): Promise<void> {
    const identity = typeof item === "string" ? { name: item } : item;
    const workspace = this.pageManager.workspacePage;

    const node = await workspace.findItemNode(identity);
    if (node) await workspace.clickNode(node);
    await workspace.navigateSpec();
    await workspace.removeRuleset();
  }

  /**
   * Opens `testSuite`'s Tests tab, selects `testSuite`, runs every test in
   * it, and reads back the resulting pass/fail summary and per-test rows.
   * @param testSuite - The suite to run
   * @returns The settled run summary and each test's title/pass state
   */
  async runAllTests(testSuite: TestSuite): Promise<UnitTestRunResult> {
    const workspace = this.pageManager.workspacePage;
    await this.openTests(testSuite.collection);
    await workspace.selectTestSuite(testSuite.name);

    await workspace.runAllTests();
    return {
      summary: await workspace.getTestResultSummary(),
      rows: await workspace.getTestResultRows(),
    };
  }

  /**
   * Uploads a Spectral ruleset. If accepted, confirms it actually took
   * effect by polling the lint panel until `expectCode` appears among the
   * fired rules — bundling/re-linting happens asynchronously after the
   * "View selected ruleset content" button already shows, so a bare read
   * right after `WorkspacePage.uploadRuleset()` can catch a stale rule
   * list — and returns the settled rule list. If rejected, dismisses the
   * resulting "Invalid Spectral Ruleset" error dialog and returns
   * `"invalid"` instead, leaving the default ruleset active.
   * @param filePath - Absolute path to the ruleset file to upload
   * @param expectCode - A rule id the accepted ruleset should introduce, e.g. "require-x-test-marker" — omit when uploading a ruleset expected to be rejected
   * @returns The settled list of fired rule ids if accepted, or `"invalid"` if rejected
   */
  async uploadRuleset(
    filePath: string,
    expectCode?: string,
  ): Promise<string[] | "invalid"> {
    const workspace = this.pageManager.workspacePage;
    const result = await workspace.uploadRuleset(filePath);
    if (result === "invalid") {
      await workspace.closeDialog();
      return "invalid";
    }

    await workspace.expandLintPanel();
    if (expectCode) {
      await expect
        .poll(() => workspace.getLintEntryCodes(), {
          timeout: DEFAULT_TIMEOUT,
        })
        .toContain(expectCode);
    }
    return workspace.getLintEntryCodes();
  }

  private async createCollection(
    parent: Project,
    name: string,
    fileName?: string,
  ): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(parent);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.Collection);
    await workspace.setNewItemName(name);
    if (fileName !== undefined) {
      await workspace.setCollectionFileName(fileName);
    }
    await workspace.clickCreate();
  }

  /**
   * Types `spec` into `name`'s spec editor right after creation —
   * boilerplate-wrapped into Swagger 2.0 JSON when given as a
   * `Specification`, written verbatim otherwise (e.g. a hand-built
   * OpenAPI 3.0 payload).
   * @param name - The name of the just-created collection to author into
   * @param spec - The spec to author
   */
  private async authorSpec(
    name: string,
    spec: NonNullable<Collection["spec"]>,
  ): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.findItemNode({ name });
    await workspace.clickNode(node!);
    await workspace.navigateSpec();
    await workspace.setSpecification(
      typeof spec === "string"
        ? spec
        : JSON.stringify({
            swagger: "2.0",
            host: "localhost",
            schemes: ["http"],
            info: spec.info,
            paths: spec.paths,
          }),
    );
  }

  private async createEnvironment(
    parent: Project,
    name: string,
  ): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(parent);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.Environment);
    await workspace.setNewItemName(name);
    await workspace.clickCreate();
  }

  private async createMcpClient(parent: Project, name: string): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(parent);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.McpClient);
    await workspace.setNewItemName(name);
    await workspace.clickCreate();
  }

  private async createProject(project: Project): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    await workspace.clickNewProject();
    await workspace.setNewItemName(project.name);
    await workspace.setNewProjectType(project.type);
    await workspace.clickCreate();
  }

  /**
   * Creates a new Git Sync Project by adopting an existing local folder
   * (running `git init` inside it if it isn't already a repo) instead of
   * cloning from a remote URL — the "Open local folder" mode of the
   * create-project dialog's Git sub-form.
   */
  private async openFolder(project: Project): Promise<void> {
    const { workspacePage, projectSettingsPage } = this.pageManager;
    await workspacePage.clickNewProject();
    await workspacePage.setNewItemName(project.name);
    await workspacePage.setNewProjectType(project.type);

    await projectSettingsPage.selectGitOpenMode();
    await projectSettingsPage.chooseOpenFolderLocation(project.folderPath!);
    await projectSettingsPage.confirmOpenFolder();
  }

  private async cloneFromRemote(
    project: Project,
    credentialName: string,
    repo?: Partial<GitRepoConnection>,
  ): Promise<Project> {
    const uri = repo?.uri ?? this.gitRepoUrl;
    if (!uri) {
      throw new Error(
        "create(): no repo URI given for a Git Sync project — either pass repo.uri, or use the `user` fixture from misc/git-fixtures.ts, which injects one",
      );
    }
    const branch = repo?.branch ?? "master";

    const { workspacePage, projectSettingsPage } = this.pageManager;
    await workspacePage.clickNewProject();
    await workspacePage.setNewItemName(project.name);
    await workspacePage.setNewProjectType(project.type);

    await projectSettingsPage.selectCredential(credentialName);
    await projectSettingsPage.setRepositoryUrl(uri);
    await projectSettingsPage.selectBranch(branch);
    if (repo?.cloneParentDir) {
      await projectSettingsPage.chooseCloneLocation(repo.cloneParentDir);
    }
    await projectSettingsPage.submitScanForFiles();
    await projectSettingsPage.confirmClone();

    return this.assertCreated(
      await this.getProject(project.name),
      project.name,
    );
  }

  private async getEnvironment(
    item: string | { name: string; id?: string },
  ): Promise<Environment | undefined> {
    const identity = typeof item === "string" ? { name: item } : item;
    const node = await this.pageManager.workspacePage.findItemNode(identity);
    if (!node) return undefined;
    return Object.assign(new Environment({ name: identity.name }), {
      id: node._id,
    });
  }

  /**
   * Finds the tree node matching `item` and returns it as an McpClient model.
   * @param item - The MCP Client name, or an object with name and optional id to match
   * @returns The matching McpClient with `id` populated, or undefined if not found
   */
  private async getMcpClient(
    item: string | { name: string; id?: string },
  ): Promise<McpClient | undefined> {
    const identity = typeof item === "string" ? { name: item } : item;
    const node = await this.pageManager.workspacePage.findItemNode(identity);
    if (!node) return undefined;
    const mcpClient = new McpClient(identity.name);
    mcpClient.id = node._id;
    return mcpClient;
  }

  /**
   * Finds the tree node matching `item` and returns it as a Project model.
   * @param item - The project name, or an object with name and optional id to match
   * @returns The matching Project with `id` populated, or undefined if not found
   */
  async getProject(
    item: string | { name: string; id?: string },
  ): Promise<Project | undefined> {
    const identity = typeof item === "string" ? { name: item } : item;
    const node = await this.pageManager.workspacePage.findItemNode(identity);
    if (!node) return undefined;
    return Object.assign(new Project(identity.name, ProjectType.Local), {
      id: node._id,
    });
  }

  private async getResolved(
    node: TreeNode,
    resolved: { name: string; id: string },
  ): Promise<WorkspaceItem | undefined> {
    const workspace = this.pageManager.workspacePage;

    if (node.type === TreeNodeType.Project) {
      const project = await this.getProject(resolved);
      return project && { ...project, kind: "project" };
    }

    if (node.type === TreeNodeType.Request) {
      const flows = this.flowManager;
      const label = await workspace.getRequestTypeLabel(node);
      switch (label) {
        case "GQL": {
          const request = await flows.graphqlRequestFlow.get(resolved);
          return request && { ...request, kind: "graphql" };
        }
        case "gRPC": {
          const request = await flows.grpcRequestFlow.get(resolved);
          return request && { ...request, kind: "grpc" };
        }
        case "SSE": {
          const request = await flows.eventStreamRequestFlow.get(resolved);
          return request && { ...request, kind: "eventStream" };
        }
        case "IO": {
          const request = await flows.socketIoRequestFlow.get(resolved);
          return request && { ...request, kind: "socketIO" };
        }
        case "WS": {
          const request = await flows.webSocketRequestFlow.get(resolved);
          return request && { ...request, kind: "webSocket" };
        }
        default: {
          const request = await flows.httpRequestFlow.get(resolved);
          return request && { ...request, kind: "http" };
        }
      }
    }

    const subKind = await workspace.getWorkspaceItemKind(node);
    if (subKind === "mcpClient") {
      const mcpClient = await this.getMcpClient(resolved);
      return (
        mcpClient && Object.assign(mcpClient, { kind: "mcpClient" as const })
      );
    }
    const collection = await this.getCollection(resolved);
    return collection && { ...collection, kind: "collection" };
  }

  /**
   * Whether `ensureLegacyUnitTestsEnabled()` has already turned the
   * Preferences -> General "Show legacy unit tests" setting on for this
   * test — cached so repeated `openTests()` calls don't reopen Preferences
   * every time.
   */
  private legacyUnitTestsEnabled = false;

  /**
   * Turns on Preferences -> General's "Show legacy unit tests" setting
   * (default off since INS-3528), which gates whether the Tests tab
   * renders at all on a Collection. A no-op after the first call.
   */
  private async ensureLegacyUnitTestsEnabled(): Promise<void> {
    if (this.legacyUnitTestsEnabled) return;
    await this.flowManager.preferencesFlow.set(
      new Settings({ showLegacyUnitTests: true }),
    );
    this.legacyUnitTestsEnabled = true;
  }

  /**
   * Finds `item`'s tree node (if not already resolved) and opens its
   * Tests tab — the entry point for every unit-test-suite action. Turns on
   * the "Show legacy unit tests" setting first (see
   * `ensureLegacyUnitTestsEnabled()`), since the tab doesn't render at all
   * while it's off.
   * @param item - The collection's name, or an object with `name`/`id`
   * @returns The resolved tree node, or `undefined` if `item` couldn't be found
   */
  private async openTests(
    item: string | { name: string; id?: string },
  ): Promise<{ _id: string } | undefined> {
    await this.ensureLegacyUnitTestsEnabled();

    const identity = typeof item === "string" ? { name: item } : item;
    const workspace = this.pageManager.workspacePage;

    const node = await workspace.findItemNode(identity);
    if (node) await workspace.clickNode(node);
    await workspace.openTestsTab();
    return node;
  }
}

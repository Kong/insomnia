import type { FlowContext } from "@package/misc/flow-context";
import { step } from "@package/misc/step";
import type { Collection } from "@package/models/collection";
import {
  Environment,
  ENVIRONMENT_TYPE,
} from "@package/models/environment";
import type { EventStreamRequest } from "@package/models/event-stream-request";
import type { GraphQLRequest } from "@package/models/graphql-request";
import type { GrpcRequest } from "@package/models/grpc-request";
import type { HttpRequest } from "@package/models/http-request";
import type { McpClient } from "@package/models/mcp-client";
import type { Project } from "@package/models/project";
import type { SocketIORequest } from "@package/models/socket-io-request";
import type { WebSocketRequest } from "@package/models/websocket-request";
import type { PageManager } from "@package/pages/page-manager";

import { BaseFlow } from "./base.flow";
import type { WorkspaceFlow } from "./workspace.flow";

const BASE_ENVIRONMENT_NAME = "Base Environment";

export class EnvironmentFlow extends BaseFlow {
  constructor(
    context: FlowContext,
    pageManager: PageManager,
    private readonly workspaceFlow: WorkspaceFlow,
  ) {
    super(context, pageManager);
  }

  /**
   * Creates/renames the workspace's Base Environment under `parent`, then
   * applies `environment.kvPairData`.
   */
  @step()
  async createBaseEnvironment(parent: Project, environment: Environment): Promise<Environment> {
    await this.workspaceFlow.createEnvironment(parent, environment);
    if (environment.name !== BASE_ENVIRONMENT_NAME) {
      await this.pageManager.environmentPage.renameEnvironment(
        BASE_ENVIRONMENT_NAME,
        environment.name,
      );
    }
    const created = await this.applyVariables(environment);
    return Object.assign(created, { containerName: environment.name });
  }

  /**
   * Creates a sub-environment nested under `parent`, then applies
   * `environment.kvPairData`.
   */
  @step()
  async createSubEnvironment(parent: Environment, environment: Environment): Promise<Environment> {
    await this.addAndRenameSubEnvironment(
      environment.name,
      environment.isPrivate ?? false,
    );
    const created = await this.applyVariables(environment);
    return parent.containerName ? Object.assign(created, { containerName: parent.containerName }) : created;
  }

  /**
   * Finds an environment by name/id and reads its variables back.
   */
  @step()
  async get(
    item: string | { name: string; id?: string },
  ): Promise<Environment | undefined> {
    const identity = typeof item === "string" ? { name: item } : item;
    const environmentPage = this.pageManager.environmentPage;
    await environmentPage.navigate();

    const names = await environmentPage.getEnvironmentNames();
    if (!names.includes(identity.name)) return undefined;

    await environmentPage.selectEnvironment(identity.name);
    const kvPairData = await environmentPage.getVariables();
    const treeNode = await this.pageManager.workspacePage.findItemNode({
      name: identity.name,
    });
    const id =
      treeNode?._id ?? (await environmentPage.getEnvironmentId(identity.name));
    return new Environment({
      name: identity.name,
      kvPairData,
      type: ENVIRONMENT_TYPE,
      id,
    });
  }

  /**
   * Links a project Environment into `item` via the "Select a Project
   * Environment" picker.
   */
  @step()
  async link(
    item:
      | Collection
      | McpClient
      | HttpRequest
      | EventStreamRequest
      | GraphQLRequest
      | GrpcRequest
      | SocketIORequest
      | WebSocketRequest,
    environment: Environment,
  ): Promise<void> {
    if (!environment.containerName) {
      throw new Error(
        `Environment "${environment.name}" has no containerName to link — ` +
          "only an Environment returned by create() can be linked.",
      );
    }
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(item);
    await workspace.clickNode(node);

    await this.pageManager.environmentPage.linkProjectEnvironment(
      environment.containerName,
      environment.name,
    );
  }

  /**
   * Activates one of `collection`'s own built-in "Collection Environments"
   * (its Base Environment, or a private/shared sub-environment nested
   * directly under it — e.g. from an imported legacy-format collection).
   * Distinct from `link()`, which instead attaches a separate Project
   * Environment; both can be active on the same collection at once.
   */
  @step()
  async activate(collection: Collection, name: string): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(collection);
    await workspace.clickNode(node);
    await this.pageManager.environmentPage.selectCollectionEnvironment(name);
  }

  /**
   * Opens one environment picker on `collection`'s toolbar and reports
   * which picker popovers are open, then dismisses it.
   */
  @step()
  async getOpenPickersAfterOpening(
    collection: Collection,
    picker: "project" | "collection",
  ): Promise<("project" | "collection")[]> {
    const workspace = this.pageManager.workspacePage;
    const environmentPage = this.pageManager.environmentPage;
    const node = await workspace.resolveNode(collection);
    await workspace.clickNode(node);

    await environmentPage.openEnvironmentPicker(picker);
    const open = await environmentPage.getOpenEnvironmentPickers();
    await environmentPage.closeEnvironmentPicker();
    return open;
  }

  /**
   * Creates a Project Environment from `collection`'s project picker and
   * reads the picker back, without linking the new environment.
   */
  @step()
  async addProjectEnvironmentFromPicker(
    collection: Collection,
    name: string,
  ): Promise<{ selected: string; options: string[] }> {
    const workspace = this.pageManager.workspacePage;
    const environmentPage = this.pageManager.environmentPage;
    const node = await workspace.resolveNode(collection);
    await workspace.clickNode(node);

    await environmentPage.addProjectEnvironment(name);
    await workspace.clickNode(node);
    return environmentPage.getProjectEnvironmentPickerState();
  }

  /**
   * Creates a shared or private sub-environment inside `collection`'s own
   * "Manage Environments" modal and reports whether it is marked private.
   */
  @step()
  async createCollectionSubEnvironment(
    collection: Collection,
    environment: Environment,
  ): Promise<{ isPrivate: boolean }> {
    const workspace = this.pageManager.workspacePage;
    const environmentPage = this.pageManager.environmentPage;
    const node = await workspace.resolveNode(collection);
    await workspace.clickNode(node);

    await environmentPage.openCollectionEnvironmentManager();
    await this.addAndRenameSubEnvironment(environment.name, environment.isPrivate ?? false);
    const isPrivate = await environmentPage.isEnvironmentPrivate(environment.name);
    await environmentPage.closeCollectionEnvironmentManager();
    return { isPrivate };
  }

  /**
   * Adds a shared or private sub-environment from the sidebar, waits for the
   * new row to appear, then renames it from its auto-generated default name
   * to `name`.
   */
  private async addAndRenameSubEnvironment(
    name: string,
    isPrivate: boolean,
  ): Promise<void> {
    const environmentPage = this.pageManager.environmentPage;
    const countBefore = await environmentPage.getEnvironmentCount();
    await environmentPage.clickAddSubEnvironment(isPrivate);
    await environmentPage.waitForEnvironmentCount(countBefore + 1);
    const defaultName = await environmentPage.getLastEnvironmentName();
    await environmentPage.renameEnvironment(defaultName, name);
  }

  private async applyVariables(environment: Environment): Promise<Environment> {
    const environmentPage = this.pageManager.environmentPage;
    if (environment.kvPairData?.length) {
      await environmentPage.selectEnvironment(environment.name);
      await environmentPage.setVariables(environment.kvPairData);
    }

    return this.assertCreated(
      await this.get(environment.name),
      environment.name,
    );
  }
}

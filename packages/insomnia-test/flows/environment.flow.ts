import type { Collection } from "../models/collection";
import {
  Environment,
  ENVIRONMENT_TYPE,
} from "../models/environment";
import type { EventStreamRequest } from "../models/event-stream-request";
import type { GraphQLRequest } from "../models/graphql-request";
import type { GrpcRequest } from "../models/grpc-request";
import type { HttpRequest } from "../models/http-request";
import type { McpClient } from "../models/mcp-client";
import type { Project } from "../models/project";
import type { SocketIORequest } from "../models/socket-io-request";
import type { WebSocketRequest } from "../models/websocket-request";
import type { PageManager } from "../pages/page-manager";
import { BaseFlow } from "./base.flow";
import type { FlowContext } from "./flow-context";
import type { WorkspaceFlow } from "./workspace.flow";

const BASE_ENVIRONMENT_NAME = "Base Environment";

export class EnvironmentFlow extends BaseFlow {
  constructor(
    flowManager: FlowContext,
    pageManager: PageManager,
    private readonly workspaceFlow: WorkspaceFlow,
  ) {
    super(flowManager, pageManager);
  }

  /**
   * Creates/renames the workspace's Base Environment under `parent`, then
   * applies `environment.kvPairData`.
   */
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
  async createSubEnvironment(parent: Environment, environment: Environment): Promise<Environment> {
    await this.pageManager.environmentPage.createSubEnvironment(
      environment.name,
      environment.isPrivate ?? false,
    );
    const created = await this.applyVariables(environment);
    return parent.containerName ? Object.assign(created, { containerName: parent.containerName }) : created;
  }

  /**
   * Finds an environment by name/id and reads its variables back.
   */
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
  async addProjectEnvironmentFromPicker(
    collection: Collection,
    name: string,
  ): Promise<{ selected: string; options: string[] }> {
    const workspace = this.pageManager.workspacePage;
    const environmentPage = this.pageManager.environmentPage;
    const node = await workspace.resolveNode(collection);
    await workspace.clickNode(node);

    await environmentPage.addProjectEnvironment(name, collection.name);
    return environmentPage.getProjectEnvironmentPickerState();
  }

  /**
   * Creates a shared or private sub-environment inside `collection`'s own
   * "Manage Environments" modal and reports whether it is marked private.
   */
  async createCollectionSubEnvironment(
    collection: Collection,
    environment: Environment,
  ): Promise<{ isPrivate: boolean }> {
    const workspace = this.pageManager.workspacePage;
    const environmentPage = this.pageManager.environmentPage;
    const node = await workspace.resolveNode(collection);
    await workspace.clickNode(node);

    await environmentPage.openCollectionEnvironmentManager();
    await environmentPage.createSubEnvironment(environment.name, environment.isPrivate ?? false);
    const isPrivate = await environmentPage.isEnvironmentPrivate(environment.name);
    await environmentPage.closeCollectionEnvironmentManager();
    return { isPrivate };
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

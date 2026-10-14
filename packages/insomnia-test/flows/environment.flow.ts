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
  /**
   * @param flowManager - The owning FlowManager
   * @param pageManager - The shared PageManager
   * @param workspaceFlow - Used to create the workspace an environment is added to
   */
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
   * @param parent - The Project to create/rename the Base Environment in
   * @param environment - The environment to create, including variables to set
   * @returns The created environment, with `containerName` populated
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
   * @param parent - The Environment to nest a sub-environment under; must be the object returned by `createBaseEnvironment()`
   * @param environment - The sub-environment to create, including variables to set
   * @returns The created environment, with `containerName` inherited from `parent` if set
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
   * @param item - The environment's name, or an object with `name`/`id`
   * @returns The found environment, or `undefined` if not found
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
   * @param item - The Collection/McpClient/request to link the environment into
   * @param environment - Must be the object returned by `create()` — it needs `environment.containerName`
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
   * @param collection - The collection whose own environment to activate
   * @param name - The environment/sub-environment name to activate
   */
  async activate(collection: Collection, name: string): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(collection);
    await workspace.clickNode(node);
    await this.pageManager.environmentPage.selectCollectionEnvironment(name);
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

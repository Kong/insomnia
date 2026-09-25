import type { Collection } from "../models/collection";
import {
  Environment,
  ENVIRONMENT_TYPE,
  isEnvironmentItem,
} from "../models/environment";
import type { EventStreamRequest } from "../models/event-stream-request";
import type { GraphQLRequest } from "../models/graphql-request";
import type { GrpcRequest } from "../models/grpc-request";
import type { HttpRequest } from "../models/http-request";
import type { McpClient } from "../models/mcp-client";
import type { Project } from "../models/project";
import type { SocketIORequest } from "../models/socket-io-request";
import type { WebSocketRequest } from "../models/websocket-request";
import { BaseFlow } from "./base.flow";

const BASE_ENVIRONMENT_NAME = "Base Environment";

export class EnvironmentFlow extends BaseFlow {
  /**
   * Creates/renames the workspace's Base Environment (when `parent` is a
   * Project), or a sub-environment under it (when `parent` is an
   * Environment), then applies `environment.kvPairData`.
   * @param parent - A Project to create/rename the Base Environment, or an Environment to nest a sub-environment under
   * @param environment - The environment to create, including variables to set
   * @returns The created environment, with `containerName` populated
   */
  async create(
    parent: Project | Environment,
    environment: Environment,
  ): Promise<Environment> {
    let containerName: string | undefined;
    if (isEnvironmentItem(parent)) {
      await this.createSubEnvironment(environment);
      containerName = parent.containerName;
    } else {
      containerName = await this.createBaseEnvironment(parent, environment);
    }
    const created = await this.applyVariables(environment);
    return containerName ? Object.assign(created, { containerName }) : created;
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

  private async createBaseEnvironment(
    parent: Project,
    environment: Environment,
  ): Promise<string> {
    await this.flowManager.workspaceFlow.create(parent, {
      name: environment.name,
      type: ENVIRONMENT_TYPE,
    });
    if (environment.name !== BASE_ENVIRONMENT_NAME) {
      await this.pageManager.environmentPage.renameEnvironment(
        BASE_ENVIRONMENT_NAME,
        environment.name,
      );
    }
    return environment.name;
  }

  private async createSubEnvironment(environment: Environment): Promise<void> {
    await this.pageManager.environmentPage.createSubEnvironment(
      environment.name,
      environment.isPrivate ?? false,
    );
  }
}

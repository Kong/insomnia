import type { FlowContext } from "@package/misc/flow-context";
import { step } from "@package/misc/step";
import type { Collection } from "@package/models/collection";
import {
  Environment,
  ENVIRONMENT_TYPE,
} from "@package/models/environment";
import type { HttpRequest } from "@package/models/http-request";
import type { Project } from "@package/models/project";
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
    item: Collection | HttpRequest,
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

import { ContextMenuItem } from "@package/enums/context-menu-items";
import { step } from "@package/misc/step";
import { MockServer } from "@package/models/mock-server";
import type { Project } from "@package/models/project";

import { BaseFlow } from "./base.flow";

export class MockServerFlow extends BaseFlow {
  /**
   * Creates a self-hosted Mock Server under `parent` through the project's
   * create menu and the create dialog, then re-reads it from the tree.
   */
  @step()
  async create(parent: Project, server: MockServer): Promise<MockServer> {
    const workspace = this.pageManager.workspacePage;
    const mockServerPage = this.pageManager.mockServerPage;

    const node = await workspace.resolveNode(parent);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.MockServer);
    await workspace.setNewItemName(server.name);
    await mockServerPage.setSelfHostedUrl(server.url);
    await workspace.clickCreate();

    return this.get(server.name);
  }

  /**
   * Finds a Mock Server's tree node by name/id and returns it as a model.
   */
  @step()
  async get(item: string | { name: string; id?: string }): Promise<MockServer> {
    const identity = typeof item === "string" ? { name: item } : item;
    const node = await this.pageManager.workspacePage.findItemNode(identity);
    this.assertCreated(node, identity.name);
    return Object.assign(new MockServer(identity.name, ""), { id: node!._id });
  }

  /**
   * Renames `server` through its context menu's "Rename" action, then
   * re-reads it from the tree under the new name.
   */
  @step()
  async rename(server: MockServer, newName: string): Promise<MockServer> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(server);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.Rename);
    await workspace.setItemName(newName);
    await workspace.clickRename();
    return this.get(newName);
  }
}

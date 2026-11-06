import { ContextMenuItem } from "@package/enums/context-menu-items";
import { TreeNodeType } from "@package/enums/tree-node-types";
import { step } from "@package/misc/step";
import type { Collection } from "@package/models/collection";
import { Folder } from "@package/models/folder";

import { BaseFlow } from "./base.flow";

export class FolderFlow extends BaseFlow {
  /**
   * Creates a new Folder under `parent`, via the same "right-click ->
   * pick the create option -> name it -> Create" sequence as creating a
   * request (see `HttpRequestFlow.create()`), just with a different
   * context-menu item and a plain naming dialog instead of a rename step.
   */
  @step()
  async create(parent: Collection | Folder, folder: Folder): Promise<Folder> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.resolveNode(parent);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.Folder);
    await workspace.setItemName(folder.name);
    await workspace.clickCreate();

    return this.assertCreated(await this.get(folder.name), folder.name);
  }

  /**
   * Reads back an existing folder's identity by name.
   */
  private async get(name: string): Promise<Folder | undefined> {
    const node = await this.pageManager.workspacePage.findItemNode(
      { name },
      TreeNodeType.Folder,
    );
    if (!node) return undefined;
    const folder = new Folder(name);
    folder.id = node._id;
    return folder;
  }
}

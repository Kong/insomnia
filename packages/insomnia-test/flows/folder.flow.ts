import { ContextMenuItem } from "../enums/context-menu-items";
import { TreeNodeType } from "../enums/tree-node-types";
import type { Collection } from "../models/collection";
import { Folder } from "../models/folder";
import type { OAuth2Tokens } from "../pages/auth-tab.page";
import type { FolderPage } from "../pages/folder.page";
import { BaseFlow } from "./base.flow";

export class FolderFlow extends BaseFlow {
  /**
   * Creates a new Folder under `parent`, via the same "right-click ->
   * pick the create option -> name it -> Create" sequence as creating a
   * request (see `HttpRequestFlow.create()`), just with a different
   * context-menu item and a plain naming dialog instead of a rename step.
   * @param parent - The Collection or Folder under which the folder is created
   * @param folder - The folder definition to create
   * @returns The created folder, read back and asserted to exist
   */
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
   * @param name - The folder's name
   * @returns The folder populated with its id, or undefined if not found
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

  /**
   * Opens a folder's own editor tab (Auth/Headers/Scripts/Environment/
   * Docs) via its "Open in New Tab" context-menu item — not the same as
   * its "Settings" item, which only opens a rename/move dialog.
   * @param folder - The folder to open, as returned by `create()`/`get()`
   * @returns The FolderPage, once its tab pane is confirmed visible
   */
  async open(folder: Folder): Promise<FolderPage> {
    const workspace = this.pageManager.workspacePage;
    const node = await workspace.findItemNode(
      { name: folder.name, id: folder.id },
      TreeNodeType.Folder,
    );
    if (!node) throw new Error(`Folder "${folder.name}" not found`);
    await workspace.rightClick(node);
    await workspace.clickContextMenu(ContextMenuItem.OpenInNewTab);

    const folderPage = this.pageManager.folderPage;
    await folderPage.navigate();
    return folderPage;
  }

  /**
   * Opens `folder` and clicks its Auth tab's token-fetch button (see
   * `AuthTabPage.fetchOAuth2Tokens()` — "Fetch Tokens" before any token
   * exists, "Refresh Token" once one does), then reads back the
   * resulting Refresh/Identity/Access Token fields in one call.
   * @param folder - The folder whose Auth tab already has OAuth 2.0 configured
   * @returns The tokens now stored on that folder's Auth tab
   */
  async fetchOAuth2Tokens(folder: Folder): Promise<OAuth2Tokens> {
    const folderPage = await this.open(folder);
    await folderPage.fetchOAuth2Tokens();
    return folderPage.getOAuth2Tokens();
  }
}

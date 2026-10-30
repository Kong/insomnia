import { ContextMenuItem } from "../enums/context-menu-items";
import { TreeNodeType } from "../enums/tree-node-types";
import type { Collection } from "../models/collection";
import { Folder } from "../models/folder";
import type { OAuth2Tokens } from "../pages/auth-tab.page";
import type { FolderPage } from "../pages/folder.page";
import type { RequestScripts } from "../pages/script-tab.page";
import { BaseFlow } from "./base.flow";

export class FolderFlow extends BaseFlow {
  /**
   * Creates a new Folder under `parent`, via the same "right-click ->
   * pick the create option -> name it -> Create" sequence as creating a
   * request (see `HttpRequestFlow.create()`), just with a different
   * context-menu item and a plain naming dialog instead of a rename step.
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
   * `AuthTabComponent.fetchOAuth2Tokens()` — "Fetch Tokens" before any
   * token exists, "Refresh Token" once one does), then reads back the
   * resulting Refresh/Identity/Access Token fields in one call.
   */
  async fetchOAuth2Tokens(folder: Folder): Promise<OAuth2Tokens> {
    const folderPage = await this.open(folder);
    await folderPage.auth.fetchOAuth2Tokens();
    return folderPage.auth.getOAuth2Tokens();
  }

  /**
   * Opens `folder` and sets its own pre-request and/or after-response
   * scripts (see `ScriptTabComponent.setScripts()`) — these run for
   * every descendant request before/after that request's own script.
   */
  async setScripts(folder: Folder, scripts: RequestScripts): Promise<void> {
    const folderPage = await this.open(folder);
    await folderPage.scripts.setScripts(scripts);
  }

  /**
   * Opens `folder` and sets its own Environment tab variables — they
   * override the collection's base and sub-environment values for every
   * descendant request.
   */
  async setEnvironmentVariables(folder: Folder, variables: Record<string, string>): Promise<void> {
    const folderPage = await this.open(folder);
    await folderPage.setEnvironmentVariables(variables);
  }
}

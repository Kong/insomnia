import { BaseFlow } from "./base.flow";
import { ContextMenuItem } from "../enums/context-menu-items";
import { ImportSource } from "../enums/import-sources";
import { CurlCommand } from "../models/curl-command";
import { Collection } from "../models/collection";
import { Project } from "../models/project";

export class ImportFlow extends BaseFlow {
  /**
   * Opens the Import dialog from `project`'s context menu, scans clipboard
   * content pasted into the import source, then imports it into the project.
   * @param project - The project to right-click and import into
   * @param content - The clipboard content to paste and scan
   */
  async importClipboard(project: Project, content: string): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const projectNode = (await workspace.getTree())
      .flatten()
      .find((n) => n.name === project.name)!;
    await workspace.rightClick(projectNode);
    await workspace.clickContextMenu(ContextMenuItem.Import);

    const importPage = this.pageManager.importPage;
    await importPage.navigate();
    await importPage.selectSource(ImportSource.Clipboard);
    await importPage.setClipboardContent(content);
    await importPage.clickScan();

    await importPage.selectProject(project.name);
    await importPage.clickImport();
  }

  /**
   * Opens the Import dialog from `project`'s context menu, scans a raw curl
   * command, then imports it into the given collection within that project.
   * @param project - The project to right-click and import into
   * @param collection - The collection to select as the import target
   * @param curl - The curl command to scan and import
   */
  async importCurl(
    project: Project,
    collection: Collection,
    curl: CurlCommand,
  ): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const projectNode = (await workspace.getTree())
      .flatten()
      .find((n) => n.name === project.name)!;
    await workspace.rightClick(projectNode);
    await workspace.clickContextMenu(ContextMenuItem.Import);

    const importPage = this.pageManager.importPage;
    await importPage.navigate();
    await importPage.selectSource(ImportSource.Curl);
    await importPage.setCurlCommand(curl.command);
    await importPage.clickScan();

    await importPage.selectProject(project.name);
    await importPage.selectCollection(collection.name);

    await importPage.clickImport();
  }

  /**
   * Opens the Import dialog from `project`'s context menu, scans a local
   * file, then imports it into the project.
   * @param project - The project to right-click and import into
   * @param filePath - The path of the file to scan and import
   */
  async importFile(project: Project, filePath: string): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const projectNode = (await workspace.getTree())
      .flatten()
      .find((n) => n.name === project.name)!;
    await workspace.rightClick(projectNode);
    await workspace.clickContextMenu(ContextMenuItem.Import);

    const importPage = this.pageManager.importPage;
    await importPage.navigate();
    await importPage.selectSource(ImportSource.File);
    await importPage.setFile(filePath);
    await importPage.clickScan();

    await importPage.selectProject(project.name);
    await importPage.clickImport();
  }

  /**
   * Opens the Import dialog from `project`'s context menu, scans an MCP
   * server URL, then imports it into the project.
   * @param project - The project to right-click and import into
   * @param url - The MCP server URL to scan and import from
   */
  async importMcp(project: Project, url: string): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const projectNode = (await workspace.getTree())
      .flatten()
      .find((n) => n.name === project.name)!;
    await workspace.rightClick(projectNode);
    await workspace.clickContextMenu(ContextMenuItem.Import);

    const importPage = this.pageManager.importPage;
    await importPage.navigate();
    await importPage.selectSource(ImportSource.Mcp);
    await importPage.setMcpUrl(url);
    await importPage.clickScan();

    await importPage.selectProject(project.name);
    await importPage.clickImport();
  }

  /**
   * Opens the Import dialog from `project`'s context menu, scans content
   * fetched from a URL, then imports it into the project.
   * @param project - The project to right-click and import into
   * @param url - The URL to scan and import from
   */
  async importUrl(project: Project, url: string): Promise<void> {
    const workspace = this.pageManager.workspacePage;
    const projectNode = (await workspace.getTree())
      .flatten()
      .find((n) => n.name === project.name)!;
    await workspace.rightClick(projectNode);
    await workspace.clickContextMenu(ContextMenuItem.Import);

    const importPage = this.pageManager.importPage;
    await importPage.navigate();
    await importPage.selectSource(ImportSource.Url);
    await importPage.setUrl(url);
    await importPage.clickScan();

    await importPage.selectProject(project.name);
    await importPage.clickImport();
  }
}

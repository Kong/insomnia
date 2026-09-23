import { ExportFormat } from "../enums/export-format";
import { ContextMenuItem } from "../enums/context-menu-items";
import { Project } from "../models/project";
import { Collection } from "../models/collection";
import { BaseFlow } from "./base.flow";

export class ExportFlow extends BaseFlow {
  /**
   * Exports a single Collection to one file via its own sidebar/dashboard
   * "Export" context-menu item, confirming the request-selection step
   * (every request stays checked).
   * @param item - The Collection to export
   * @param format - The file format to export as
   * @param path - Absolute path the exported file should be written to
   */
  async export(
    item: Collection,
    format: ExportFormat,
    path: string,
  ): Promise<void>;
  /**
   * Exports every workspace under a Project to a directory (one file
   * each) via Preferences -> Data, selecting `format`. Skips the
   * request-selection step, which only Collection-scoped exports show.
   * @param item - The Project to export
   * @param format - The file format to export as
   * @param path - Absolute directory path the exported files should be written into
   */
  async export(
    item: Project,
    format: ExportFormat,
    path: string,
  ): Promise<void>;
  /**
   * Exports every Project in the app to a directory (one file per
   * workspace) via Preferences -> Data. Always writes as Insomnia v5 —
   * this entry point has no request-selection or format-selection step.
   * @param directoryPath - Absolute directory path the exported files should be written into
   */
  async export(directoryPath: string): Promise<void>;
  async export(
    itemOrDirectoryPath: Collection | Project | string,
    format?: ExportFormat,
    path?: string,
  ): Promise<void> {
    const { workspacePage, preferencesPage, exportPage } = this.pageManager;

    if (typeof itemOrDirectoryPath === "string") {
      await exportPage.stubSaveDirectoryLocation(itemOrDirectoryPath);
      await preferencesPage.open();
      await preferencesPage.openDataTab();
      await preferencesPage.clickExportAllData();
      await exportPage.dismissCompletionIfShown();
      if (await preferencesPage.isOpen()) await preferencesPage.close();
      return;
    }

    const item = itemOrDirectoryPath;
    if (item instanceof Collection) {
      const node = await workspacePage.resolveNode(item);
      await exportPage.stubSaveFileLocation(path!);
      await workspacePage.rightClick(node);
      await workspacePage.clickContextMenu(ContextMenuItem.Export);
      await exportPage.navigate();
      await exportPage.confirmRequestSelection();
      await exportPage.selectFormat(format!);
      await exportPage.confirmFormat();
      return;
    }

    await workspacePage.clickNode(await workspacePage.resolveNode(item));
    await exportPage.stubSaveDirectoryLocation(path!);
    await preferencesPage.open();
    await preferencesPage.openDataTab();
    await preferencesPage.clickExportProject(item.name);
    await exportPage.navigate();
    await exportPage.selectFormat(format!);
    await exportPage.confirmFormat();
    await exportPage.dismissCompletionIfShown();
    if (await preferencesPage.isOpen()) await preferencesPage.close();
  }
}

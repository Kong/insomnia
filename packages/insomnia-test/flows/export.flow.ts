import type { ApiSpecExportFormat } from "../enums/api-spec-export-format";
import { ContextMenuItem } from "../enums/context-menu-items";
import type { ExportFormat } from "../enums/export-format";
import { Collection } from "../models/collection";
import type { Project } from "../models/project";
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
    // eslint-disable-next-line @typescript-eslint/unified-signatures -- kept separate from the Collection overload above: distinct JSDoc per export scope
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

  /**
   * Exports a Collection's OpenAPI spec (only the spec, not the rest of
   * the collection) to a single file via the sidebar workspace
   * dropdown's "Export OpenAPI Spec" item, choosing `format` in the
   * resulting modal. If the collection's spec is empty/missing, the
   * click surfaces a "Cannot export" alert instead of the format modal —
   * `ExportPage.exportOpenApiSpec()` is decorated with `@throwOnDialog`,
   * so this rejects with that alert's trimmed text in that case; dismiss
   * it with `workspaceFlow.closeDialog()` before continuing.
   * @param item - The Collection whose OpenAPI spec to export
   * @param format - YAML or JSON
   * @param path - Absolute file path the exported spec should be written to
   */
  async exportOpenApiSpec(
    item: Collection,
    format: ApiSpecExportFormat,
    path: string,
  ): Promise<void> {
    const { workspacePage, exportPage } = this.pageManager;
    const node = await workspacePage.resolveNode(item);
    await exportPage.stubSaveFileLocation(path);
    await workspacePage.openWorkspaceActionsDropdown(node);
    await workspacePage.clickContextMenu(ContextMenuItem.ExportOpenApiSpec);
    await exportPage.exportOpenApiSpec(format);
  }
}

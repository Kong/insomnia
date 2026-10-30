import type { ApiSpecExportFormat } from "../enums/api-spec-export-format";
import { ContextMenuItem } from "../enums/context-menu-items";
import type { ExportFormat } from "../enums/export-format";
import type { Collection } from "../models/collection";
import type { Project } from "../models/project";
import { BaseFlow } from "./base.flow";

export class ExportFlow extends BaseFlow {
  /**
   * Exports a single Collection to one file via its own sidebar/dashboard
   * "Export" context-menu item, confirming the request-selection step
   * (every request stays checked).
   */
  async exportCollection(item: Collection, format: ExportFormat, path: string): Promise<void> {
    const { workspacePage, exportPage } = this.pageManager;
    const node = await workspacePage.resolveNode(item);
    await exportPage.stubSaveFileLocation(path);
    await workspacePage.rightClick(node);
    await workspacePage.clickContextMenu(ContextMenuItem.Export);
    await exportPage.navigate();
    await exportPage.confirmRequestSelection();
    await exportPage.selectFormat(format);
    await exportPage.confirmFormat();
  }

  /**
   * Exports every workspace under a Project to a directory (one file
   * each) via Preferences -> Data, selecting `format`. Skips the
   * request-selection step, which only Collection-scoped exports show.
   */
  async exportProject(item: Project, format: ExportFormat, path: string): Promise<void> {
    const { workspacePage, preferencesPage, exportPage } = this.pageManager;
    await workspacePage.clickNode(await workspacePage.resolveNode(item));
    await exportPage.stubSaveDirectoryLocation(path);
    await preferencesPage.open();
    await preferencesPage.openDataTab();
    await preferencesPage.clickExportProject(item.name);
    await exportPage.navigate();
    await exportPage.selectFormat(format);
    await exportPage.confirmFormat();
    await exportPage.dismissCompletionIfShown();
    if (await preferencesPage.isOpen()) await preferencesPage.close();
  }

  /**
   * Exports every Project in the app to a directory (one file per
   * workspace) via Preferences -> Data. Always writes as Insomnia v5 —
   * this entry point has no request-selection or format-selection step.
   */
  async exportAllData(directoryPath: string): Promise<void> {
    const { preferencesPage, exportPage } = this.pageManager;
    await exportPage.stubSaveDirectoryLocation(directoryPath);
    await preferencesPage.open();
    await preferencesPage.openDataTab();
    await preferencesPage.clickExportAllData();
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

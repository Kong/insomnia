import type { ApiSpecExportFormat } from "@package/enums/api-spec-export-format";
import { ContextMenuItem } from "@package/enums/context-menu-items";
import type { ExportFormat } from "@package/enums/export-format";
import { step } from "@package/misc/step";
import type { Collection } from "@package/models/collection";
import type { Project } from "@package/models/project";

import { BaseFlow } from "./base.flow";

export class ExportFlow extends BaseFlow {
  /**
   * Exports a single Collection to one file via its own sidebar/dashboard
   * "Export" context-menu item, confirming the request-selection step
   * (every request stays checked).
   */
  @step()
  async exportCollection(item: Collection, format: ExportFormat, path: string): Promise<void> {
    const { workspacePage, exportPage } = this.pageManager;
    const node = await workspacePage.resolveNode(item);
    await this.context.stubSaveDialog(path);
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
  @step()
  async exportProject(item: Project, format: ExportFormat, path: string): Promise<void> {
    const { workspacePage, preferences, exportPage } = this.pageManager;
    await workspacePage.clickNode(await workspacePage.resolveNode(item));
    await this.context.stubFileChooser(path);
    await preferences.open();
    await preferences.openDataTab();
    await preferences.clickExportProject(item.name);
    await exportPage.navigate();
    await exportPage.selectFormat(format);
    await exportPage.confirmFormat();
    await exportPage.dismissCompletionIfShown();
    if (await preferences.isOpen()) await preferences.close();
  }

  /**
   * Exports every Project in the app to a directory (one file per
   * workspace) via Preferences -> Data. Always writes as Insomnia v5 —
   * this entry point has no request-selection or format-selection step.
   */
  @step()
  async exportAllData(directoryPath: string): Promise<void> {
    const { preferences, exportPage } = this.pageManager;
    await this.context.stubFileChooser(directoryPath);
    await preferences.open();
    await preferences.openDataTab();
    await preferences.clickExportAllData();
    await exportPage.dismissCompletionIfShown();
    if (await preferences.isOpen()) await preferences.close();
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
  @step()
  async exportOpenApiSpec(
    item: Collection,
    format: ApiSpecExportFormat,
    path: string,
  ): Promise<void> {
    const { workspacePage, exportPage } = this.pageManager;
    const node = await workspacePage.resolveNode(item);
    await this.context.stubSaveDialog(path);
    await workspacePage.openWorkspaceActionsDropdown(node);
    await workspacePage.clickContextMenu(ContextMenuItem.ExportOpenApiSpec);
    await exportPage.exportOpenApiSpec(format);
  }
}

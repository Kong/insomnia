import type { ApiSpecExportFormat } from "@package/enums/api-spec-export-format";
import { ContextMenuItem } from "@package/enums/context-menu-items";
import { step } from "@package/misc/step";
import type { Collection } from "@package/models/collection";

import { BaseFlow } from "./base.flow";

export class ExportFlow extends BaseFlow {
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

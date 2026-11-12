import { ContextMenuItem } from "@package/enums/context-menu-items";
import type { ExportFormat } from "@package/enums/export-format";
import { step } from "@package/misc/step";
import type { Collection } from "@package/models/collection";

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
}

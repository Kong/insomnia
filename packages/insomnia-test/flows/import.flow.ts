import { ContextMenuItem } from "@package/enums/context-menu-items";
import { ImportSource } from "@package/enums/import-sources";
import { step } from "@package/misc/step";
import type { Project } from "@package/models/project";

import { BaseFlow } from "./base.flow";

export class ImportFlow extends BaseFlow {
  /**
   * Opens the Import dialog from `project`'s context menu, scans a local
   * file, then imports it into the project.
   */
  @step()
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
}

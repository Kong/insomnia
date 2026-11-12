import { DEFAULT_TIMEOUT } from "@package/misc/constants";
import {
  collectHiddenWindowCoverage,
  collectWindowCoverage,
  startWindowCoverage,
  trackHiddenWindowCoverage,
} from "@package/misc/coverage";
import { launchInsomniaElectron } from "@package/misc/launch";
import { step } from "@package/misc/step";
import type { Page } from "playwright-core";

import { BaseFlow } from "./base.flow";

export class AppFlow extends BaseFlow {
  /**
   * Closes the current Electron app and relaunches a fresh one against
   * the same `dataPath`/env (`SessionContext.launchConfig`) — for proving
   * state survives an app restart, not just a page reload. Rewires
   * `context`/`pageManager` onto the new app in place, so the same
   * `user.flowManager`/`user.pageManager` instances keep working.
   */
  @step()
  async restart(): Promise<Page> {
    const config = this.context.launchConfig;
    if (!config) {
      throw new Error(
        "AppFlow.restart() requires the SessionContext to have been constructed with a launchConfig — see misc/fixtures.ts's `user` fixture",
      );
    }

    await collectWindowCoverage(
      await this.context.electronApp!.firstWindow({
        timeout: DEFAULT_TIMEOUT,
      }),
    );
    await collectHiddenWindowCoverage(this.context.electronApp!);
    await this.context.electronApp!.close();
    const app = await launchInsomniaElectron(config);
    trackHiddenWindowCoverage(app);

    const win = await app.firstWindow({ timeout: DEFAULT_TIMEOUT });
    await win.waitForLoadState(undefined, { timeout: DEFAULT_TIMEOUT });
    win.setDefaultTimeout(DEFAULT_TIMEOUT);
    await startWindowCoverage(win);
    await app.evaluate(({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows().find((w) =>
        w.isVisible(),
      );
      mainWindow?.maximize();
    });

    this.context.setElectronApp(app);
    this.pageManager.setWindow(win);
    await this.pageManager.workspacePage.navigate();

    return win;
  }
}

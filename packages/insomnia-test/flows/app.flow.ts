import type { Page } from "playwright-core";

import { DEFAULT_TIMEOUT, launchInsomniaElectron } from "../misc/fixtures";
import { BaseFlow } from "./base.flow";

export class AppFlow extends BaseFlow {
  /**
   * Closes the current Electron app and relaunches a fresh one against
   * the same `dataPath`/env (`FlowManager.launchConfig`) — for proving
   * state survives an app restart, not just a page reload. Rewires
   * `flowManager`/`pageManager` onto the new app in place, so the same
   * `user.flowManager`/`user.pageManager` instances keep working.
   * @returns The fresh app's main window
   */
  async restart(): Promise<Page> {
    const config = this.flowManager.launchConfig;
    if (!config) {
      throw new Error(
        "AppFlow.restart() requires the FlowManager to have been constructed with a launchConfig — see misc/fixtures.ts's `user` fixture",
      );
    }

    await this.flowManager.electronApp!.close();
    const app = await launchInsomniaElectron(config);

    const win = await app.firstWindow({ timeout: DEFAULT_TIMEOUT });
    await win.waitForLoadState(undefined, { timeout: DEFAULT_TIMEOUT });
    win.setDefaultTimeout(DEFAULT_TIMEOUT);
    await app.evaluate(({ BrowserWindow }) => {
      const mainWindow = BrowserWindow.getAllWindows().find((w) =>
        w.isVisible(),
      );
      mainWindow?.maximize();
    });

    this.flowManager.setElectronApp(app);
    this.pageManager.setWindow(win, app);
    await this.pageManager.workspacePage.navigate();

    return win;
  }

  /**
   * Schedules an async EPIPE error event on the main process's
   * `process.stdout` (via `process.nextTick`, mirroring how the OS
   * actually delivers it) and flushes the main-process event loop with
   * `setImmediate` before returning, so the error has been fully
   * handled by the time this resolves.
   */
  async emitStdoutEpipeError(): Promise<void> {
    await this.flowManager.electronApp!.evaluate(() => {
      process.nextTick(() => {
        const err: NodeJS.ErrnoException = new Error("write EPIPE");
        err.code = "EPIPE";
        process.stdout.emit("error", err);
      });
    });
    await this.flowManager.electronApp!.evaluate(
      () => new Promise<void>((resolve) => setImmediate(resolve)),
    );
  }

  /**
   * Reads the number of listeners currently registered for a given
   * event on the main process's `process.stdout` (e.g. `"error"`,
   * `"close"`, `"drain"`).
   * @param event - The event name to check
   * @returns The listener count
   */
  async getStdoutListenerCount(event: string): Promise<number> {
    return this.flowManager.electronApp!.evaluate(
      (_electron, evt) => process.stdout.listenerCount(evt),
      event,
    );
  }

  /**
   * Confirms the main process is still responsive by round-tripping a
   * trivial `evaluate()` call. If the main process had crashed, this
   * call itself would reject with a "Target closed" error.
   * @returns Always `true` when the call succeeds
   */
  async isAlive(): Promise<boolean> {
    return this.flowManager.electronApp!.evaluate(() => true);
  }

  /**
   * Reads the main process's `userData` directory — the same path
   * Insomnia backs up its NeDB `.db` files under (`<dataPath>/backups`).
   * @returns The absolute path to the app's data directory
   */
  async getDataPath(): Promise<string> {
    return this.flowManager.electronApp!.evaluate(({ app }) =>
      app.getPath("userData"),
    );
  }

  /**
   * Sends the `mainWindowFocusChange` IPC event (with `focused: true`) to
   * every open `BrowserWindow`'s renderer, simulating the app regaining
   * OS focus — this is what triggers Cloud Sync's background
   * "check for remote changes" logic on a real focus change, without
   * actually needing to blur/refocus the Electron window from the OS.
   */
  async simulateMainWindowFocusChange(): Promise<void> {
    await this.flowManager.electronApp!.evaluate(({ BrowserWindow }) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send("mainWindowFocusChange", true);
      }
    });
  }

  /**
   * Captures every line the main process writes to stdout/stderr while
   * `action` runs, plus a short settle window afterward (log lines can
   * trail slightly behind the action that produced them), and returns
   * them in order. Only lines written during this call are captured —
   * nothing from before it started.
   * @param action - The action to run while capturing
   * @returns Every captured stdout/stderr line, in order
   */
  async captureMainProcessLog(action: () => Promise<void>): Promise<string[]> {
    const lines: string[] = [];
    const proc = this.flowManager.electronApp!.process();
    const onData = (chunk: Buffer) => {
      lines.push(...chunk.toString().split("\n").filter(Boolean));
    };
    proc.stdout?.on("data", onData);
    proc.stderr?.on("data", onData);
    try {
      await action();
      await new Promise((resolve) => setTimeout(resolve, 500));
    } finally {
      proc.stdout?.off("data", onData);
      proc.stderr?.off("data", onData);
    }
    return lines;
  }

  /**
   * Finds the hidden `BrowserWindow` the app uses to execute pre-request/
   * after-response scripts (titled "Hidden Browser Window") and closes it
   * directly — simulating it being killed mid-script. The app is expected
   * to detect this and spin up a fresh one the next time a script needs
   * to run.
   * @throws If no window with that title is currently open
   */
  async closeHiddenScriptWindow(): Promise<void> {
    for (const win of await this.flowManager.electronApp!.windows()) {
      if ((await win.title().catch(() => "")) === "Hidden Browser Window") {
        await win.close();
        return;
      }
    }
    throw new Error('Window with title "Hidden Browser Window" not found');
  }
}

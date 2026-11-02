import type { ElectronApplication } from "@playwright/test";

import type { AppLaunchConfig, FlowContext } from "./flow-context";

/**
 * Holds the session-level state every flow shares. It imports no flow, so
 * it sits below both `FlowManager` (the factory) and the flows themselves.
 */
export class SessionContext implements FlowContext {
  constructor(
    private insomnia?: ElectronApplication,
    private readonly appLaunchConfig?: AppLaunchConfig,
  ) {}

  /**
   * The underlying ElectronApplication handle, for AppFlow to reach the
   * main process directly without going through a DOM-facing Page.
   */
  get electronApp(): ElectronApplication | undefined {
    return this.insomnia;
  }

  /**
   * The launch parameters this session's `insomnia` fixture originally
   * used — see `AppFlow.restart()`.
   */
  get launchConfig(): AppLaunchConfig | undefined {
    return this.appLaunchConfig;
  }

  /**
   * Rewires `electronApp` onto a freshly-relaunched ElectronApplication —
   * called by `AppFlow.restart()` once the new app is up.
   */
  setElectronApp(insomnia: ElectronApplication): void {
    this.insomnia = insomnia;
  }

  /**
   * Reads the main process's `userData` directory.
   */
  async getDataPath(): Promise<string> {
    return this.insomnia!.evaluate(({ app }) => app.getPath("userData"));
  }

  /**
   * Stubs Electron's native file-picker dialog so a "Choose File" button
   * can be automated without an OS-level file chooser.
   */
  async stubFileChooser(filePath: string): Promise<void> {
    await this.requireElectronApp("stub the file chooser").evaluate(
      ({ dialog }, fp) => {
        dialog.showOpenDialog = (async () => ({
          canceled: false,
          filePaths: [fp],
        })) as typeof dialog.showOpenDialog;
      },
      filePath,
    );
  }

  /**
   * Stubs Electron's native file-save dialog so an export action that
   * writes a single file can be automated without an OS-level save
   * prompt.
   */
  async stubSaveDialog(filePath: string): Promise<void> {
    await this.requireElectronApp("stub the save dialog").evaluate(
      ({ dialog }, fp) => {
        dialog.showSaveDialog = (async () => ({
          canceled: false,
          filePath: fp,
        })) as typeof dialog.showSaveDialog;
      },
      filePath,
    );
  }

  private requireElectronApp(action: string): ElectronApplication {
    if (!this.insomnia) {
      throw new Error(
        `ElectronApplication not available — pass \`insomnia\` to SessionContext to ${action}`,
      );
    }
    return this.insomnia;
  }
}

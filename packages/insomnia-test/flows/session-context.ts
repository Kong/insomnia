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
}

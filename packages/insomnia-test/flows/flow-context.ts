import type { ElectronApplication } from "@playwright/test";

/**
 * The `insomnia` fixture's original launch parameters — kept around so
 * `AppFlow.restart()` can relaunch against the same `dataPath` later
 * without re-deriving them.
 */
export interface AppLaunchConfig {
  dataPath: string;
  skipOnboarding: boolean;
  vaultKey: string;
  vaultSalt: string;
}

/**
 * The session-level state every flow shares. `FlowManager` implements it;
 * flows depend on this interface instead of `FlowManager` itself so that
 * the manager (which imports every flow) doesn't form an import cycle with
 * `BaseFlow`.
 */
export interface FlowContext {
  /** The underlying ElectronApplication handle, if one was passed in. */
  readonly electronApp: ElectronApplication | undefined;
  /** The launch parameters the `insomnia` fixture originally used — see `AppFlow.restart()`. */
  readonly launchConfig: AppLaunchConfig | undefined;
  /** Rewires `electronApp` onto a freshly-relaunched ElectronApplication. */
  setElectronApp(insomnia: ElectronApplication): void;
  /** Reads the main process's `userData` directory. */
  getDataPath(): Promise<string>;
}

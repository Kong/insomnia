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
 * The session-level state every flow shares. `SessionContext` implements
 * it and `FlowManager` hands it to each flow it creates, so flows never
 * depend on the manager (which imports every flow).
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
  /**
   * Stubs Electron's native open/folder-picker dialog so the next "Choose
   * File"/"Choose folder" click resolves to `filePath` without an OS prompt.
   */
  stubFileChooser(filePath: string): Promise<void>;
  /**
   * Stubs Electron's native save dialog so the next export/save action
   * writes to `filePath` without an OS prompt.
   */
  stubSaveDialog(filePath: string): Promise<void>;
}

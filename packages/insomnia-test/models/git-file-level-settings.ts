export interface GitFileLevelSettingsNames {
  workspace: string;
  previousWorkspace: string;
  mockServerUrl: string;
  mockWorkspace: string;
}

export interface GitFileLevelSettings {
  names: GitFileLevelSettingsNames;
  build: (changed: boolean) => { spec: string; mock: string };
}

export interface RunnerOptions {
  iterations?: number;
  delay?: number;
  keepLogs?: boolean;
  bail?: boolean;
  dataFilePath?: string;
}

export interface RunnerRequestItem {
  name: string;
  method: string;
  selected: boolean;
}

export interface RunnerTestResult {
  name: string;
  status: string;
  durationMs?: number;
  bytes?: number;
}

export interface RunnerIterationResult {
  iteration: number;
  results: RunnerTestResult[];
}

export interface RunnerTestResultCount {
  passed: number;
  total: number;
}

export type RunnerResultFilter = "All" | "Passed" | "Failed" | "Skipped";

export type RunnerResultsByFilter = Map<
  RunnerResultFilter,
  RunnerIterationResult[]
>;

export interface RunnerRunResult {
  testResultCount: RunnerTestResultCount;
  iterationResults: RunnerResultsByFilter;
}

export interface RunnerLiveStatus {
  running: boolean;
  finished: number;
  total: number;
  skipped: number;
  canceled: number;
}

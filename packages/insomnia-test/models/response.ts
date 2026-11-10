import type { ResponseHeader } from "insomnia-data";

export interface StreamEvent {
  data: string;
  time: string;
  preview?: unknown;
}

export interface ResponseTestResult {
  name: string;
  status: string;
  error?: string;
}

/**
 * The status/time/size tags in the response pane's header bar.
 */
export interface ResponseStatusBar {
  /** Status tag as displayed, e.g. "200 OK". */
  text?: string;
  code?: number;
  message?: string;
  elapsedTime?: number;
  bytesContent?: number;
}

/**
 * What the response pane currently shows, organised by the areas a user sees:
 * the header bar, the Preview/Headers tabs, and the debug tabs (console,
 * stream events, script test results), which are read lazily from the UI.
 */
export interface ResponseView {
  statusBar: ResponseStatusBar;
  /** Content of the Preview tab, parsed as JSON when possible. */
  preview?: unknown;
  /** Rows of the Headers tab. */
  headers: ResponseHeader[];
  console: () => Promise<string>;
  events: () => Promise<StreamEvent[]>;
  tests: () => Promise<ResponseTestResult[] | undefined>;
}

export type { ResponseHeader };

import type {
  Response as AppResponse,
  ResponseHeader,
} from "insomnia-data";

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
 * What the response pane currently shows: the response itself plus debug
 * info (console, stream events, script test results) read lazily from the UI.
 */
export type ResponseView = Partial<
  Pick<
    AppResponse,
    "statusCode" | "statusMessage" | "elapsedTime" | "bytesContent" | "headers"
  >
> & {
  body?: unknown;
  console?: () => Promise<string>;
  events?: () => Promise<StreamEvent[]>;
  tests?: () => Promise<ResponseTestResult[] | undefined>;
};

export type { ResponseHeader };

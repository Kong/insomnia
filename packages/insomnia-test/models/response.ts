import type {
  Response as AppResponse,
  ResponseHeader,
} from "../../insomnia-data/src/models/response";

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

export type Response = Partial<
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

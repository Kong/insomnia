import type { BaseServices, McpResponse } from '~/insomnia-data';

type Override<T, R> = Omit<T, keyof R> & R;

export type McpResponseService = Override<
  BaseServices<'McpResponse'>,
  {
    create(patch?: Partial<McpResponse>, maxResponses?: number): Promise<McpResponse>;
    updateOrCreate(patch: Partial<McpResponse>, maxResponses?: number): Promise<McpResponse>;
    getLatestForRequestId(requestId: string, environmentId: string | null): Promise<McpResponse | undefined>;
  }
>;

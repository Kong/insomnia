import type { Example, Request } from 'insomnia-data';
import { services } from 'insomnia-data';

import { exampleKeys } from '~/common/app-data';
import { useDBQuery } from '~/ui/hooks/use-query';

export interface ExampleData {
  example: Example;
  parentRequest: Request;
}

/**
 * Full example document for the editor. Workspace-wide payloads carry only
 * summaries (no bodies), so the editor reads its own document plus the parent
 * request it needs for the request snapshot overlay, and the DB change
 * listener keeps that entry fresh.
 */
export const useExampleQuery = (exampleId: string, options?: { enabled?: boolean }) =>
  useDBQuery({
    queryKey: exampleKeys.byId(exampleId),
    queryFn: async (): Promise<ExampleData | undefined> => {
      const example = await services.example.getById(exampleId);
      if (!example) {
        return undefined;
      }
      const parentRequest = await services.request.getById(example.parentId);
      return parentRequest ? { example, parentRequest } : undefined;
    },
    enabled: options?.enabled ?? true,
  });

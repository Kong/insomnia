import { services } from 'insomnia-data';

import { exampleKeys } from '~/common/app-data';
import { useDBQuery } from '~/ui/hooks/use-query';

/**
 * Full example document for the editor. Workspace-wide payloads carry only
 * summaries (no bodies), so the editor reads its own document, and the DB change
 * listener patches that entry in place on writes.
 */
export const useExampleQuery = (exampleId: string, options?: { enabled?: boolean }) =>
  useDBQuery({
    queryKey: exampleKeys.byId(exampleId),
    queryFn: () => services.example.getById(exampleId),
    enabled: options?.enabled ?? true,
  });

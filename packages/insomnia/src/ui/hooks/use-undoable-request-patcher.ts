import { useParams } from 'react-router';

import {
  type RequestLoaderData,
  useRequestLoaderData,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { useUndoContext } from '~/ui/context/app/undo-context';
import { pick } from '~/ui/context/app/undo-stack';
import { useRequestPatcher } from '~/ui/hooks/use-request';

/**
 * A drop-in replacement for {@link useRequestPatcher} that records each edit on the global
 * undo stack before applying it. Recording only happens when on the HTTP request debug route
 * (where `useRequestLoaderData()` resolves) — edits made elsewhere (e.g. request-group headers,
 * sidebar) fall through to the raw patcher and never enter the stack.
 */
export const useUndoableRequestPatcher = () => {
  const patchRequest = useRequestPatcher();
  const loaderData = useRequestLoaderData() as RequestLoaderData | undefined;
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const { recordEdit } = useUndoContext();

  return (requestId: string, patch: Record<string, any>) => {
    const activeRequest = loaderData?.activeRequest;
    // Only record when we have authoritative pre-edit state for this request.
    if (activeRequest && activeRequest._id === requestId) {
      const keys = Object.keys(patch);
      const before = pick(activeRequest, keys);
      const after = pick({ ...activeRequest, ...patch }, keys);
      recordEdit({ organizationId, projectId, workspaceId, requestId, before, after });
    }
    patchRequest(requestId, patch);
  };
};

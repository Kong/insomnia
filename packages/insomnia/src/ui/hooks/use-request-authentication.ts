import type { RequestAuthentication } from 'insomnia-data';

import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useRequestLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { useRequestGroupLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId';
import { useRequestGroupPatcher, useRequestPatcher, useWorkspacePatcher } from '~/ui/hooks/use-request';

// Fetch auth data from either a  request, a folder or (collection-level auth) the workspace; whichever route is active owns the auth.
export const useAuthentication = () => {
  const reqData = useRequestLoaderData();
  const groupData = useRequestGroupLoaderData();
  const { activeWorkspace } = useWorkspaceLoaderData()!;
  const patchRequest = useRequestPatcher();
  const patchRequestGroup = useRequestGroupPatcher();
  const patchWorkspace = useWorkspacePatcher();

  const owner = reqData?.activeRequest || groupData?.activeRequestGroup || activeWorkspace;
  const ownerId = owner._id;
  const ownerPatcher = reqData ? patchRequest : groupData ? patchRequestGroup : patchWorkspace;
  const patcher = (patch: { authentication: RequestAuthentication | {} }) => ownerPatcher(ownerId, patch);

  return {
    authentication: ('authentication' in owner ? (owner.authentication ?? {}) : {}) as RequestAuthentication | {},
    _id: owner._id,
    patcher,
  };
};

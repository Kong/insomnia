import type { RequestAccordionKeys, RequestAuthentication, RequestMeta } from 'insomnia-data';

import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import {
  type RequestLoaderData,
  useRequestLoaderData,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { useRequestGroupLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId';
import { useExampleEditorContext } from '~/ui/context/example-editor-context';
import {
  useRequestGroupPatcher,
  useRequestMetaPatcher,
  useRequestPatcher,
  useWorkspacePatcher,
} from '~/ui/hooks/use-request';

// Fetch auth data from either a request, an example, a folder or (collection-level auth) the workspace; whichever route is active owns the auth.
export const useAuthentication = () => {
  const exampleEditor = useExampleEditorContext();
  const reqData = useRequestLoaderData();
  const groupData = useRequestGroupLoaderData();
  const { activeWorkspace } = useWorkspaceLoaderData()!;
  const patchRequest = useRequestPatcher();
  const patchRequestGroup = useRequestGroupPatcher();
  const patchWorkspace = useWorkspacePatcher();
  const patchRequestMeta = useRequestMetaPatcher();

  if (exampleEditor) {
    const { exampleId, request, patchRequest: patchExampleRequest } = exampleEditor;
    return {
      authentication: (request.authentication ?? {}) as RequestAuthentication | {},
      _id: exampleId,
      isExample: true,
      patcher: (patch: { authentication: RequestAuthentication | {} }) => patchExampleRequest(exampleId, patch),
      // Examples have no request meta, so the auth accordion keeps its expansion in local state.
      expandedAccordionKeys: undefined as Partial<Record<RequestAccordionKeys, boolean>> | undefined,
      patchMeta: (_patch: Partial<RequestMeta>) => {},
    };
  }

  const owner = reqData?.activeRequest || groupData?.activeRequestGroup || activeWorkspace;
  const ownerId = owner._id;
  const ownerPatcher = reqData ? patchRequest : groupData ? patchRequestGroup : patchWorkspace;
  const patcher = (patch: { authentication: RequestAuthentication | {} }) => ownerPatcher(ownerId, patch);

  return {
    authentication: ('authentication' in owner ? (owner.authentication ?? {}) : {}) as RequestAuthentication | {},
    _id: owner._id,
    isExample: false,
    patcher,
    expandedAccordionKeys: (reqData as RequestLoaderData | undefined)?.activeRequestMeta?.expandedAccordionKeys,
    patchMeta: (patch: Partial<RequestMeta>) => patchRequestMeta(ownerId, patch),
  };
};

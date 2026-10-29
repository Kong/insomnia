import type { RequestAccordionKeys, RequestAuthentication, RequestMeta } from 'insomnia-data';

import {
  type RequestLoaderData,
  useRequestLoaderData,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import {
  type RequestGroupLoaderData,
  useRequestGroupLoaderData,
} from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request-group.$requestGroupId';
import { useExampleEditorContext } from '~/ui/context/example-editor-context';
import { useRequestGroupPatcher, useRequestMetaPatcher, useRequestPatcher } from '~/ui/hooks/use-request';

/**
 * Auth editors are shared by the request pane, the folder pane and the example
 * pane. They edit `authentication` through whichever document is open, so the
 * data source is resolved once here instead of in every row component.
 */
export const useAuthEditor = () => {
  const exampleEditor = useExampleEditorContext();
  const reqData = useRequestLoaderData() as RequestLoaderData | undefined;
  const groupData = useRequestGroupLoaderData() as RequestGroupLoaderData | undefined;
  const patchRequest = useRequestPatcher();
  const patchRequestGroup = useRequestGroupPatcher();
  const patchRequestMeta = useRequestMetaPatcher();
  const activeRequest = reqData?.activeRequest;
  const activeRequestGroup = groupData?.activeRequestGroup;

  if (exampleEditor) {
    const { exampleId, request, patchRequest: patchExampleRequest } = exampleEditor;
    return {
      authentication: request.authentication,
      requestId: exampleId,
      isExample: true,
      patchAuthentication: (patch: Record<string, unknown>) =>
        patchExampleRequest(exampleId, {
          authentication: { ...request.authentication, ...patch } as RequestAuthentication,
        }),
      replaceAuthentication: (next: RequestAuthentication | {}) =>
        patchExampleRequest(exampleId, { authentication: next as RequestAuthentication }),
      expandedAccordionKeys: undefined as Partial<Record<RequestAccordionKeys, boolean>> | undefined,
      // Accordion expansion is per-screen chrome; examples have no request meta
      // to store it in, so they keep it in local state instead.
      patchMeta: (_patch: Partial<RequestMeta>) => {},
    };
  }

  const authentication = (activeRequest || activeRequestGroup)?.authentication ?? {};
  const requestId = (activeRequest || activeRequestGroup)?._id ?? '';
  const patcher = activeRequest ? patchRequest : patchRequestGroup;

  return {
    authentication,
    requestId,
    isExample: false,
    patchAuthentication: (patch: Record<string, unknown>) =>
      patcher(requestId, { authentication: { ...authentication, ...patch } as RequestAuthentication }),
    replaceAuthentication: (next: RequestAuthentication | {}) =>
      patcher(requestId, { authentication: next as RequestAuthentication }),
    expandedAccordionKeys: reqData?.activeRequestMeta?.expandedAccordionKeys,
    patchMeta: (patch: Partial<RequestMeta>) => patchRequestMeta(requestId, patch),
  };
};

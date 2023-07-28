import { ActionFunction, LoaderFunction, redirect } from 'react-router-dom';

import { CONTENT_TYPE_EVENT_STREAM, CONTENT_TYPE_GRAPHQL, CONTENT_TYPE_JSON, METHOD_GET, METHOD_POST } from '../../common/constants';
import * as models from '../../models';
import { GrpcRequest, isGrpcRequestId } from '../../models/grpc-request';
import { GrpcRequestMeta } from '../../models/grpc-request-meta';
import * as requestOperations from '../../models/helpers/request-operations';
import { isRequest, Request } from '../../models/request';
import { RequestMeta } from '../../models/request-meta';
import { WebSocketRequest } from '../../models/websocket-request';
import { invariant } from '../../utils/invariant';
import { SegmentEvent } from '../analytics';
import { updateMimeType } from '../components/dropdowns/content-type-dropdown';

export interface RequestLoaderData<A, B> {
  activeRequest: A;
  activeRequestMeta: B;
}
export const loader: LoaderFunction = async ({ params }): Promise<RequestLoaderData<Request | WebSocketRequest | GrpcRequest, RequestMeta | GrpcRequestMeta>> => {
  const { requestId, workspaceId } = params;
  invariant(requestId, 'Request ID is required');
  invariant(workspaceId, 'Workspace ID is required');
  const activeRequest = await requestOperations.getById(requestId);
  invariant(activeRequest, 'Request not found');
  const activeWorkspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  invariant(activeWorkspaceMeta, 'Active workspace meta not found');
  // NOTE: loaders shouldnt mutate data, this should be moved somewhere else
  models.workspaceMeta.update(activeWorkspaceMeta, { activeRequestId: requestId });
  if (isGrpcRequestId(requestId)) {
    return {
      activeRequest,
      activeRequestMeta: await models.grpcRequestMeta.updateOrCreateByParentId(requestId, { lastActive: Date.now() }),
    };
  } else {
    return {
      activeRequest,
      activeRequestMeta: await models.requestMeta.updateOrCreateByParentId(requestId, { lastActive: Date.now() }),
    };
  }
};

export const createRequestAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  const { requestType, parentId } = await request.json();

  let activeRequestId;
  if (requestType === 'HTTP') {
    activeRequestId = (await models.request.create({
      parentId: parentId || workspaceId,
      method: METHOD_GET,
      name: 'New Request',
    }))._id;
  }
  if (requestType === 'gRPC') {
    activeRequestId = (await models.grpcRequest.create({
      parentId: parentId || workspaceId,
      name: 'New Request',
    }))._id;
  }
  if (requestType === 'GraphQL') {
    activeRequestId = (await models.request.create({
      parentId: parentId || workspaceId,
      method: METHOD_POST,
      headers: [
        {
          name: 'Content-Type',
          value: CONTENT_TYPE_JSON,
        },
      ],
      body: {
        mimeType: CONTENT_TYPE_GRAPHQL,
        text: '',
      },
      name: 'New Request',
    }))._id;
  }
  if (requestType === 'Event Stream') {
    activeRequestId = (await models.request.create({
      parentId: parentId || workspaceId,
      method: METHOD_GET,
      url: '',
      headers: [
        {
          name: 'Accept',
          value: CONTENT_TYPE_EVENT_STREAM,
        },
      ],
      name: 'New Event Stream',
    }))._id;
  }
  if (requestType === 'WebSocket') {
    activeRequestId = (await models.webSocketRequest.create({
      parentId: parentId || workspaceId,
      name: 'New WebSocket Request',
    }))._id;
  }
  invariant(typeof activeRequestId === 'string', 'Request ID is required');
  models.stats.incrementCreatedRequests();
  window.main.trackSegmentEvent({ event: SegmentEvent.requestCreate, properties: { requestType } });

  return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${activeRequestId}`);
};
export const updateRequestAction: ActionFunction = async ({ request, params }) => {
  const { requestId } = params;
  invariant(typeof requestId === 'string', 'Request ID is required');
  let req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');
  let patch = await request.json();
  // TODO: if gRPC, we should also copy the protofile to the destination workspace - INS-267
  if (isRequest(req) && patch.body) {
    const mimeType = patch.body?.mimeType as string | null;
    const requestMeta = await models.requestMeta.getOrCreateByParentId(requestId);
    const savedRequestBody = !mimeType ? (req.body || {}) : {};
    await models.requestMeta.update(requestMeta, { savedRequestBody });
    // TODO: make this less hacky, update expects latest req not patch
    req = await requestOperations.update(req, patch);
    patch = updateMimeType(req, mimeType, requestMeta.savedRequestBody);
  }

  requestOperations.update(req, patch);
  return null;
};

export const deleteRequestAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, projectId, workspaceId } = params;

  const formData = await request.formData();
  const id = formData.get('id') as string;
  const req = await requestOperations.getById(id);
  invariant(req, 'Request not found');
  models.stats.incrementDeletedRequests();
  requestOperations.remove(req);
  // TODO: redirect only if we are deleting the active request
  return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug`);
};

export const duplicateRequestAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, projectId, workspaceId, requestId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  invariant(typeof requestId === 'string', 'Request ID is required');
  const { name, parentId } = await request.json();

  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');
  if (parentId) {
    const workspace = await models.workspace.getById(parentId);
    invariant(workspace, 'Workspace is required');
    // TODO: if gRPC, we should also copy the protofile to the destination workspace - INS-267
    // Move to top of sort order
    const newRequest = await requestOperations.duplicate(req, { name, parentId, metaSortKey: -1e9 });
    invariant(newRequest, 'Failed to duplicate request');
    models.stats.incrementCreatedRequests();
    return null;
  }
  const newRequest = await requestOperations.duplicate(req, { name });
  invariant(newRequest, 'Failed to duplicate request');
  models.stats.incrementCreatedRequests();
  return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${newRequest._id}`);
};

export const updateRequestMetaAction: ActionFunction = async ({ request, params }) => {
  const { requestId } = params;
  invariant(typeof requestId === 'string', 'Request ID is required');
  const patch = await request.json();
  console.log('patch', patch);
  if (isGrpcRequestId(requestId)) {
    await models.grpcRequestMeta.updateOrCreateByParentId(requestId, patch);
    return null;
  }
  await models.requestMeta.updateOrCreateByParentId(requestId, patch);
  return null;
};

// const RequestRoute = () => {
//   const { requestId } = useParams() as { requestId: string };
//   const activeEnvironment = useSelector(selectActiveEnvironment);
//   return (<>
//     <ErrorBoundary showAlert>
//       {isGrpcRequestId(requestId) ? (
//         <GrpcRequestPane />
//       ) : (
//         isWebSocketRequestId(requestId) ? (
//           <WebSocketRequestPane
//             environment={activeEnvironment}
//           />
//         ) : (
//           <RequestPane
//             environmentId={activeEnvironment ? activeEnvironment._id : ''}
//           />
//         )
//       )}
//     </ErrorBoundary>
//   </>);
// };
// export default RequestRoute;

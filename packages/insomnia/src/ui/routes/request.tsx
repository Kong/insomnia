import { ActionFunction, LoaderFunction, redirect } from 'react-router-dom';

import { CONTENT_TYPE_GRAPHQL, CONTENT_TYPE_JSON, METHOD_GET, METHOD_POST } from '../../common/constants';
import * as models from '../../models';
import { GrpcRequest, GrpcRequestBody, GrpcRequestHeader, isGrpcRequest, isGrpcRequestId } from '../../models/grpc-request';
import * as requestOperations from '../../models/helpers/request-operations';
import { isRequest, Request, RequestAuthentication, RequestBody, RequestHeader, RequestParameter } from '../../models/request';
import { WebSocketRequest } from '../../models/websocket-request';
import { invariant } from '../../utils/invariant';
import { SegmentEvent, trackSegmentEvent } from '../analytics';
import { updateMimeType } from '../components/dropdowns/content-type-dropdown';
import { CreateRequestType } from '../hooks/create-request';

export const loader: LoaderFunction = async ({ params }): Promise<Request | WebSocketRequest | GrpcRequest> => {
  const { requestId, workspaceId } = params;
  invariant(requestId, 'Request ID is required');
  invariant(workspaceId, 'Workspace ID is required');
  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');
  const activeWorkspaceMeta = await models.workspaceMeta.getByParentId(workspaceId);
  invariant(activeWorkspaceMeta, 'Active workspace meta not found');
  models.workspaceMeta.update(activeWorkspaceMeta, { activeRequestId: requestId });
  if (isGrpcRequestId(requestId)) {
    models.grpcRequestMeta.updateOrCreateByParentId(requestId, { lastActive: Date.now() });
  } else {
    models.requestMeta.updateOrCreateByParentId(requestId, { lastActive: Date.now() });
  }
  return req;
};

export const createRequestAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const formData = await request.formData();
  const requestType = formData.get('requestType') as CreateRequestType;
  const parentId = formData.get('parentId') as string | null;
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
  if (requestType === 'WebSocket') {
    activeRequestId = (await models.webSocketRequest.create({
      parentId: parentId || workspaceId,
      name: 'New WebSocket Request',
    }))._id;
  }
  invariant(typeof activeRequestId === 'string', 'Request ID is required');
  models.stats.incrementCreatedRequests();
  trackSegmentEvent(SegmentEvent.requestCreate, { requestType });

  return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${activeRequestId}`);
};
// react-router discourages non-string form data, but :guitar: :guitar: :guitar:
export const updateHackRequestAction: ActionFunction = async ({ request, params }) => {
  const { requestId } = params;
  invariant(typeof requestId === 'string', 'Request ID is required');
  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');
  const formData = await request.formData();
  const body = formData.get('body') as string | null;
  const headers = formData.get('headers') as string | null;
  if (body !== null) {
    requestOperations.update(req, { body: JSON.parse(body) as RequestBody | GrpcRequestBody });
  }
  if (headers !== null) {
    requestOperations.update(req, { headers: JSON.parse(headers) as RequestHeader[] });
  }
  const authentication = formData.get('authentication') as string | null;
  if (authentication !== null) {
    requestOperations.update(req, { authentication: JSON.parse(authentication) as RequestAuthentication });
  }
  const parameters = formData.get('parameters') as string | null;
  if (parameters !== null) {
    requestOperations.update(req, { parameters: JSON.parse(parameters) as RequestParameter[] });
  }
  const metadata = formData.get('metadata') as string | null;
  if (metadata !== null) {
    requestOperations.update(req, { metadata: JSON.parse(metadata) as GrpcRequestHeader[] });
  }
};
// TODO: boolean serialisation needs a standard, here I am just using empty string as false. Not good.
export const updateRequestSettingAction: ActionFunction = async ({ request, params }) => {
  const { requestId } = params;
  invariant(typeof requestId === 'string', 'Request ID is required');
  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');
  const formData = await request.formData();

  const settingSendCookies = formData.get('settingSendCookies') as string | null;
  if (settingSendCookies !== null) {
    requestOperations.update(req, { settingSendCookies: Boolean(settingSendCookies) });
  }
  const settingStoreCookies = formData.get('settingStoreCookies') as string | null;
  if (settingStoreCookies !== null) {
    requestOperations.update(req, { settingStoreCookies: Boolean(settingStoreCookies) });
  }
  const settingEncodeUrl = formData.get('settingEncodeUrl') as string | null;
  if (settingEncodeUrl !== null) {
    requestOperations.update(req, { settingEncodeUrl: Boolean(settingEncodeUrl) });
  }
};
export const updateRequestAction: ActionFunction = async ({ request, params }) => {
  const { requestId } = params;
  invariant(typeof requestId === 'string', 'Request ID is required');
  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');

  const formData = await request.formData();
  const parentId = formData.get('parentId') as string | null;
  if (parentId !== null) {
    const workspace = await models.workspace.getById(parentId);
    invariant(workspace, 'Workspace is required');
    // TODO: if gRPC, we should also copy the protofile to the destination workspace - INS-267
    // Move to top of sort order
    requestOperations.update(req, { parentId, metaSortKey: -1e9 });
  }
  const name = formData.get('name') as string | null;
  if (name !== null) {
    requestOperations.update(req, { name });
  }
  const url = formData.get('url') as string | null;
  if (url !== null) {
    requestOperations.update(req, { url });
  }
  const method = formData.get('method') as string | null;
  if (method !== null) {
    requestOperations.update(req, { method });
  }
  const description = formData.get('description') as string | null;
  if (description !== null) {
    requestOperations.update(req, { description });
  }
  const settingFollowRedirects = formData.get('settingFollowRedirects') as Request['settingFollowRedirects'] | null;
  if (settingFollowRedirects !== null) {
    requestOperations.update(req, { settingFollowRedirects });
  }
  if (isRequest(req)) {
    let mimeType = formData.get('mimeType') as string | null;
    // TODO: This is a hack to get around the fact that we don't have a way to send null
    if (mimeType !== null) {
      if (mimeType === 'null') {
        mimeType = null;
      }
      const requestMeta = await models.requestMeta.getOrCreateByParentId(requestId);
      const savedRequestBody = !mimeType ? (req.body || {}) : {};
      await models.requestMeta.update(requestMeta, { savedRequestBody });
      const res = updateMimeType(req, mimeType, requestMeta.savedRequestBody);
      requestOperations.update(req, { body: res.body, headers: res.headers });
    }
  }
  if (isGrpcRequest(req)) {
    const protoMethodName = formData.get('protoMethodName') as string | null;
    if (protoMethodName !== null) {
      models.grpcRequest.update(req, { protoMethodName });
    }
    const protoFileId = formData.get('protoFileId') as string | null;
    if (protoFileId !== null) {
      models.grpcRequest.update(req, {
        protoFileId,
        protoMethodName: '',
      });
    }
    const text = formData.get('text') as string | null;
    if (text !== null) {
      models.grpcRequest.update(req, { body: { text } });
    }
  }
};

export const deleteRequestAction: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const id = formData.get('id') as string;
  const req = await requestOperations.getById(id);
  invariant(req, 'Request not found');
  models.stats.incrementDeletedRequests();
  requestOperations.remove(req);
};

export const duplicateRequestAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, projectId, workspaceId, requestId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  invariant(typeof requestId === 'string', 'Request ID is required');
  const formData = await request.formData();
  const name = formData.get('name') as string;
  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');
  const parentId = formData.get('parentId') as string | null;
  if (parentId) {
    const workspace = await models.workspace.getById(parentId);
    invariant(workspace, 'Workspace is required');
    // TODO: if gRPC, we should also copy the protofile to the destination workspace - INS-267
    // Move to top of sort order
    const newRequest = await requestOperations.duplicate(req, { name, parentId, metaSortKey: -1e9 });
    invariant(newRequest, 'Failed to duplicate request');
    models.stats.incrementCreatedRequests();
    return;
  }
  const newRequest = await requestOperations.duplicate(req, { name });
  invariant(newRequest, 'Failed to duplicate request');
  models.stats.incrementCreatedRequests();
  return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${newRequest._id}`);
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

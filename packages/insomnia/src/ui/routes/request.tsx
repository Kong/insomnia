import React from 'react';
import { useSelector } from 'react-redux';
import { ActionFunction, LoaderFunction, redirect, useParams } from 'react-router-dom';

import { CONTENT_TYPE_GRAPHQL, CONTENT_TYPE_JSON, METHOD_GET, METHOD_POST } from '../../common/constants';
import * as models from '../../models';
import { GrpcRequest, GrpcRequestBody, GrpcRequestHeader, isGrpcRequestId } from '../../models/grpc-request';
import * as requestOperations from '../../models/helpers/request-operations';
import { Request, RequestAuthentication, RequestBody, RequestHeader } from '../../models/request';
import { isWebSocketRequestId, WebSocketRequest } from '../../models/websocket-request';
import { invariant } from '../../utils/invariant';
import { SegmentEvent, trackSegmentEvent } from '../analytics';
import { ErrorBoundary } from '../components/error-boundary';
import { GrpcRequestPane } from '../components/panes/grpc-request-pane';
import { RequestPane } from '../components/panes/request-pane';
import { WebSocketRequestPane } from '../components/websockets/websocket-request-pane';
import { CreateRequestType } from '../hooks/create-request';
import { selectActiveEnvironment } from '../redux/selectors';

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
export const createRequestGroupAction: ActionFunction = async ({ request, params }) => {
  const { workspaceId } = params;
  const formData = await request.formData();
  const name = formData.get('name') as string;
  const parentId = formData.get('parentId') as string;
  const requestGroup = await models.requestGroup.create({ parentId: parentId || workspaceId, name });
  models.requestGroupMeta.create({ parentId: requestGroup._id, collapsed: false });
};
export const createRequestAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, projectId, workspaceId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');

  const formData = await request.formData();
  const requestType = formData.get('requestType') as CreateRequestType;
  const protoFileId = formData.get('protoFileId');
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
    invariant(typeof protoFileId === 'string', 'Proto File ID is required');
    activeRequestId = (await models.grpcRequest.create({
      parentId: parentId || workspaceId,
      name: 'New Request',
      protoFileId,
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
  if (body !== null) {
    requestOperations.update(req, { body: JSON.parse(body) as RequestBody | GrpcRequestBody });
  }
  const headers = formData.get('headers') as string | null;
  if (headers !== null) {
    requestOperations.update(req, { headers: JSON.parse(headers) as RequestHeader[] });
  }
  const authentication = formData.get('authentication') as string | null;
  if (authentication !== null) {
    requestOperations.update(req, { authentication: JSON.parse(authentication) as RequestAuthentication });
  }
  const metadata = formData.get('metadata') as string | null;
  if (metadata !== null) {
    requestOperations.update(req, { metadata: JSON.parse(metadata) as GrpcRequestHeader[] });
  }
};
export const updateRequestAction: ActionFunction = async ({ request, params }) => {
  const { requestId } = params;
  invariant(typeof requestId === 'string', 'Request ID is required');
  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');

  const formData = await request.formData();
  const name = formData.get('name') as string | null;
  if (name !== null) {
    requestOperations.update(req, { name });
  }
  const url = formData.get('url') as string | null;
  if (url !== null) {
    requestOperations.update(req, { url });
  }
  const protoMethodName = formData.get('protoMethodName') as string | null;
  if (protoMethodName !== null) {
    requestOperations.update(req, { protoMethodName });
  }
  const protoFileId = formData.get('protoFileId') as string | null;
  if (protoFileId !== null) {
    const initial = models.grpcRequest.init();
    requestOperations.update(req, {
      protoFileId,
      body: initial.body,
      protoMethodName: initial.protoMethodName,
    });
    // dispatch(grpcActions.invalidate(request._id));
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

export const deleteRequestGroupAction: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const id = formData.get('id') as string;
  const requestGroup = await models.requestGroup.getById(id);
  invariant(requestGroup, 'Request not found');
  models.stats.incrementDeletedRequestsForDescendents(requestGroup);
  models.requestGroup.remove(requestGroup);
};

export const duplicateRequestAction: ActionFunction = async ({ request, params }) => {
  const { organizationId, projectId, workspaceId, requestId } = params;
  invariant(typeof workspaceId === 'string', 'Workspace ID is required');
  invariant(typeof requestId === 'string', 'Request ID is required');
  const formData = await request.formData();
  const name = formData.get('name') as string;
  const req = await requestOperations.getById(requestId);
  invariant(req, 'Request not found');
  const newRequest = await requestOperations.duplicate(req, { name });
  invariant(newRequest, 'Failed to duplicate request');
  return redirect(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/debug/request/${newRequest._id}`);
};

const RequestRoute = () => {
  const { requestId } = useParams() as { requestId: string };
  const activeEnvironment = useSelector(selectActiveEnvironment);
  return (<>
    <ErrorBoundary showAlert>
      {isGrpcRequestId(requestId) ? (
        <GrpcRequestPane />
      ) : (
        isWebSocketRequestId(requestId) ? (
          <WebSocketRequestPane
            environment={activeEnvironment}
          />
        ) : (
          <RequestPane
            environmentId={activeEnvironment ? activeEnvironment._id : ''}
          />
        )
      )}
    </ErrorBoundary>
  </>);
};
export default RequestRoute;

import clone from 'clone';
import { Insomnia4Data } from 'insomnia-importers';
import YAML from 'yaml';

import { isApiSpec } from '../models/api-spec';
import { isCookieJar } from '../models/cookie-jar';
import { isEnvironment } from '../models/environment';
import { isGrpcRequest } from '../models/grpc-request';
import type { BaseModel } from '../models/index';
import * as models from '../models/index';
import { isProtoDirectory } from '../models/proto-directory';
import { isProtoFile } from '../models/proto-file';
import { isRequest } from '../models/request';
import { isRequestGroup } from '../models/request-group';
import { isUnitTest } from '../models/unit-test';
import { isUnitTestSuite } from '../models/unit-test-suite';
import { isWebSocketPayload } from '../models/websocket-payload';
import { isWebSocketRequest } from '../models/websocket-request';
import { isWorkspace, Workspace } from '../models/workspace';
import { resetKeys } from '../sync/ignore-keys';
import { SegmentEvent, trackSegmentEvent } from './analytics';
import {
  EXPORT_TYPE_API_SPEC,
  EXPORT_TYPE_COOKIE_JAR,
  EXPORT_TYPE_ENVIRONMENT,
  EXPORT_TYPE_GRPC_REQUEST,
  EXPORT_TYPE_PROTO_DIRECTORY,
  EXPORT_TYPE_PROTO_FILE,
  EXPORT_TYPE_REQUEST,
  EXPORT_TYPE_REQUEST_GROUP,
  EXPORT_TYPE_UNIT_TEST,
  EXPORT_TYPE_UNIT_TEST_SUITE,
  EXPORT_TYPE_WEBSOCKET_PAYLOAD,
  EXPORT_TYPE_WEBSOCKET_REQUEST,
  EXPORT_TYPE_WORKSPACE,
  getAppVersion,
} from './constants';
import { database as db } from './database';
import * as har from './har';

const EXPORT_FORMAT = 4;

const getDocWithDescendants = (includePrivateDocs = false) => async (parentDoc: BaseModel | null) => {
  const docs = await db.withDescendants(parentDoc);
  return docs.filter(
    // Don't include if private, except if we want to
    doc => !doc?.isPrivate || includePrivateDocs,
  );
};

export async function exportWorkspacesHAR(
  workspaces: Workspace[],
  includePrivateDocs = false,
) {
  const promises = workspaces.map(getDocWithDescendants(includePrivateDocs));
  const docs = (await Promise.all(promises)).flat();
  const requests = docs.filter(isRequest);
  return exportRequestsHAR(requests, includePrivateDocs);
}

export async function exportRequestsHAR(
  requests: BaseModel[],
  includePrivateDocs = false,
) {
  const workspaces: BaseModel[] = [];
  const mapRequestIdToWorkspace: Record<string, any> = {};
  const workspaceLookup: Record<string, any> = {};

  for (const request of requests) {
    const ancestors: BaseModel[] = await db.withAncestors(request, [
      models.workspace.type,
      models.requestGroup.type,
    ]);
    const workspace = ancestors.find(isWorkspace);
    mapRequestIdToWorkspace[request._id] = workspace;

    if (workspace == null || workspaceLookup.hasOwnProperty(workspace._id)) {
      continue;
    }

    workspaceLookup[workspace._id] = true;
    workspaces.push(workspace);
  }

  const mapWorkspaceIdToEnvironmentId: Record<string, any> = {};

  for (const workspace of workspaces) {
    const workspaceMeta = await models.workspaceMeta.getByParentId(workspace._id);
    let environmentId = workspaceMeta ? workspaceMeta.activeEnvironmentId : null;
    const environment = await models.environment.getById(environmentId || 'n/a');

    if (!environment || (environment.isPrivate && !includePrivateDocs)) {
      environmentId = 'n/a';
    }

    mapWorkspaceIdToEnvironmentId[workspace._id] = environmentId;
  }

  requests = requests.sort((a: Record<string, any>, b: Record<string, any>) =>
    a.metaSortKey < b.metaSortKey ? -1 : 1,
  );
  const harRequests: har.ExportRequest[] = [];

  for (const request of requests) {
    const workspace = mapRequestIdToWorkspace[request._id];

    if (workspace == null) {
      // Workspace not found for request, so don't export it.
      continue;
    }

    const environmentId = mapWorkspaceIdToEnvironmentId[workspace._id];
    harRequests.push({
      requestId: request._id,
      environmentId: environmentId,
    });
  }

  const data = await har.exportHar(harRequests);
  trackSegmentEvent(SegmentEvent.dataExport, { type: 'har' });
  return JSON.stringify(data, null, '\t');
}

export async function exportWorkspacesData(
  workspaces: Workspace[],
  includePrivateDocs: boolean,
  format: 'json' | 'yaml',
) {
  const promises = workspaces.map(getDocWithDescendants(includePrivateDocs));
  const docs = (await Promise.all(promises)).flat();
  const requests = docs.filter(doc => isRequest(doc) || isGrpcRequest(doc));
  return exportRequestsData(requests, includePrivateDocs, format);
}

export async function exportRequestsData(
  requests: BaseModel[],
  includePrivateDocs: boolean,
  format: 'json' | 'yaml',
) {
  const data: Insomnia4Data = {
    // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
    _type: 'export',
    __export_format: EXPORT_FORMAT,
    __export_date: new Date(),
    __export_source: `insomnia.desktop.app:v${getAppVersion()}`,
    resources: [],
  };
  const docs: BaseModel[] = [];
  const workspaces: Workspace[] = [];
  const mapTypeAndIdToDoc: Record<string, BaseModel> = {};

  for (const request of requests) {
    const ancestors = clone<BaseModel[]>(await db.withAncestors(request));

    for (const ancestor of ancestors) {
      const key = ancestor.type + '___' + ancestor._id;

      if (mapTypeAndIdToDoc.hasOwnProperty(key)) {
        continue;
      }

      mapTypeAndIdToDoc[key] = ancestor;
      docs.push(ancestor);

      if (isWorkspace(ancestor)) {
        workspaces.push(ancestor);
      }
    }
  }

  for (const workspace of workspaces) {
    const descendants = (await db.withDescendants(workspace)).filter(d => {
      // Only interested in these additional model types.
      return (
        isCookieJar(d) ||
        isEnvironment(d) ||
        isApiSpec(d) ||
        isUnitTestSuite(d) ||
        isUnitTest(d) ||
        isProtoFile(d) ||
        isProtoDirectory(d) ||
        isWebSocketPayload(d)
      );
    });
    docs.push(...descendants);
  }

  data.resources = docs
    .filter(d => {
      // Only export these model types.
      if (
        !(
          isUnitTestSuite(d) ||
          isUnitTest(d) ||
          isRequest(d) ||
          isWebSocketPayload(d) ||
          isWebSocketRequest(d) ||
          isGrpcRequest(d) ||
          isRequestGroup(d) ||
          isProtoFile(d) ||
          isProtoDirectory(d) ||
          isWorkspace(d) ||
          isCookieJar(d) ||
          isEnvironment(d) ||
          isApiSpec(d)
        )
      ) {
        return false;
      }

      // BaseModel doesn't have isPrivate, so cast it first.
      return !d.isPrivate || includePrivateDocs;
    })
    .map(d => {
      if (isWorkspace(d)) {
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
        d._type = EXPORT_TYPE_WORKSPACE;
        // reset the parentId of a workspace
        resetKeys(d);
      } else if (isCookieJar(d)) {
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
        d._type = EXPORT_TYPE_COOKIE_JAR;
      } else if (isEnvironment(d)) {
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
        d._type = EXPORT_TYPE_ENVIRONMENT;
      } else if (isUnitTestSuite(d)) {
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
        d._type = EXPORT_TYPE_UNIT_TEST_SUITE;
      } else if (isUnitTest(d)) {
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
        d._type = EXPORT_TYPE_UNIT_TEST;
      } else if (isRequestGroup(d)) {
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
        d._type = EXPORT_TYPE_REQUEST_GROUP;
      } else if (isRequest(d)) {
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
        d._type = EXPORT_TYPE_REQUEST;
      } else if (isGrpcRequest(d)) {
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
        d._type = EXPORT_TYPE_GRPC_REQUEST;
      } else if (isWebSocketPayload(d)) {
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
        d._type = EXPORT_TYPE_WEBSOCKET_PAYLOAD;
      } else if (isWebSocketRequest(d)) {
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
        d._type = EXPORT_TYPE_WEBSOCKET_REQUEST;
      } else if (isProtoFile(d)) {
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
        d._type = EXPORT_TYPE_PROTO_FILE;
      } else if (isProtoDirectory(d)) {
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
        d._type = EXPORT_TYPE_PROTO_DIRECTORY;
      } else if (isApiSpec(d)) {
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
        d._type = EXPORT_TYPE_API_SPEC;
      }

      // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
      // Delete the things we don't want to export
      delete d.type;
      return d;
    });
  trackSegmentEvent(SegmentEvent.dataExport, { type: format });

  if (format.toLowerCase() === 'yaml') {
    return YAML.stringify(data);
  } else if (format.toLowerCase() === 'json') {
    return JSON.stringify(data);
  } else {
    throw new Error(`Invalid export format ${format}. Must be "json" or "yaml"`);
  }
}

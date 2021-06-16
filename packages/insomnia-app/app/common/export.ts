import { Insomnia4Data } from 'insomnia-importers';
import clone from 'clone';
import { database as db } from './database';
import * as har from './har';
import type { BaseModel } from '../models/index';
import * as models from '../models/index';
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
  EXPORT_TYPE_WORKSPACE,
  getAppVersion,
} from './constants';
import YAML from 'yaml';
import { trackEvent } from './analytics';
import { isGrpcRequest } from '../models/grpc-request';
import { isRequest } from '../models/request';
import { isRequestGroup } from '../models/request-group';
import { isProtoDirectory } from '../models/proto-directory';
import { isProtoFile } from '../models/proto-file';
import { isWorkspace } from '../models/workspace';

const EXPORT_FORMAT = 4;

async function getDocWithDescendants(
  parentDoc: BaseModel | null = null,
  includePrivateDocs = false,
) {
  const docs = await db.withDescendants(parentDoc);
  return docs.filter(
    // Don't include if private, except if we want to
    doc => !doc?.isPrivate || includePrivateDocs,
  );
}

export async function exportWorkspacesHAR(
  model: BaseModel | null = null,
  includePrivateDocs = false,
) {
  const docs = await getDocWithDescendants(model, includePrivateDocs);
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
  trackEvent('Data', 'Export', 'HAR');
  return JSON.stringify(data, null, '\t');
}

export async function exportWorkspacesData(
  parentDoc: BaseModel | null,
  includePrivateDocs: boolean,
  format: 'json' | 'yaml',
) {
  const docs = await getDocWithDescendants(parentDoc, includePrivateDocs);
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
  const workspaces: BaseModel[] = [];
  const mapTypeAndIdToDoc: Record<string, any> = {};

  for (const req of requests) {
    const ancestors: BaseModel[] = clone(await db.withAncestors(req));

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
    const descendants: BaseModel[] = (await db.withDescendants(workspace)).filter(d => {
      // Only interested in these additional model types.
      return (
        d.type === models.cookieJar.type ||
        d.type === models.environment.type ||
        d.type === models.apiSpec.type ||
        d.type === models.unitTestSuite.type ||
        d.type === models.unitTest.type ||
        isProtoFile(d) ||
        isProtoDirectory(d)
      );
    });
    docs.push(...descendants);
  }

  data.resources = docs
    .filter(d => {
      // Only export these model types.
      if (
        !(
          d.type === models.unitTestSuite.type ||
          d.type === models.unitTest.type ||
          isRequest(d) ||
          isGrpcRequest(d) ||
          isRequestGroup(d) ||
          isProtoFile(d) ||
          isProtoDirectory(d) ||
          isWorkspace(d) ||
          // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
          d.type === models.cookieJar.type ||
          // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
          d.type === models.environment.type ||
          // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
          d.type === models.apiSpec.type
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
      } else if (d.type === models.cookieJar.type) {
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
        d._type = EXPORT_TYPE_COOKIE_JAR;
      } else if (d.type === models.environment.type) {
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
        d._type = EXPORT_TYPE_ENVIRONMENT;
      } else if (d.type === models.unitTestSuite.type) {
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
        d._type = EXPORT_TYPE_UNIT_TEST_SUITE;
      } else if (d.type === models.unitTest.type) {
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
      } else if (isProtoFile(d)) {
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
        d._type = EXPORT_TYPE_PROTO_FILE;
      } else if (isProtoDirectory(d)) {
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
        d._type = EXPORT_TYPE_PROTO_DIRECTORY;
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
      } else if (d.type === models.apiSpec.type) {
        // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
        d._type = EXPORT_TYPE_API_SPEC;
      }

      // @ts-expect-error -- TSCONVERSION maybe this needs to be added to the upstream type?
      // Delete the things we don't want to export
      delete d.type;
      return d;
    });
  trackEvent('Data', 'Export', `Insomnia ${format}`);

  if (format.toLowerCase() === 'yaml') {
    return YAML.stringify(data);
  } else if (format.toLowerCase() === 'json') {
    return JSON.stringify(data);
  } else {
    throw new Error(`Invalid export format ${format}. Must be "json" or "yaml"`);
  }
}

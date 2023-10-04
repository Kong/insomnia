import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

import { apiSpec, cookieJar, environment, grpcRequest, protoDirectory, protoFile, request, requestGroup, unitTest, unitTestSuite, webSocketPayload, webSocketRequest, workspace } from '../models';
import { ApiSpec } from '../models/api-spec';
import { CookieJar } from '../models/cookie-jar';
import { Environment } from '../models/environment';
import { GrpcRequest } from '../models/grpc-request';
import { ProtoDirectory } from '../models/proto-directory';
import { ProtoFile } from '../models/proto-file';
import { Request } from '../models/request';
import { RequestGroup } from '../models/request-group';
import { UnitTest } from '../models/unit-test';
import { UnitTestSuite } from '../models/unit-test-suite';
import { WebSocketPayload } from '../models/websocket-payload';
import { WebSocketRequest } from '../models/websocket-request';
import { Workspace } from '../models/workspace';
import type { Insomnia4Data } from '../utils/importers/importers';
import { invariant } from '../utils/invariant';
import { EXPORT_TYPE_API_SPEC, EXPORT_TYPE_COOKIE_JAR, EXPORT_TYPE_ENVIRONMENT, EXPORT_TYPE_GRPC_REQUEST, EXPORT_TYPE_PROTO_DIRECTORY, EXPORT_TYPE_PROTO_FILE, EXPORT_TYPE_REQUEST, EXPORT_TYPE_REQUEST_GROUP, EXPORT_TYPE_UNIT_TEST, EXPORT_TYPE_UNIT_TEST_SUITE, EXPORT_TYPE_WEBSOCKET_PAYLOAD, EXPORT_TYPE_WEBSOCKET_REQUEST, EXPORT_TYPE_WORKSPACE } from './constants';
import { database } from './database';

const exportTypeByModelType = (type: string) => ({
  [request.type]: EXPORT_TYPE_REQUEST,
  [webSocketPayload.type]: EXPORT_TYPE_WEBSOCKET_PAYLOAD,
  [webSocketRequest.type]: EXPORT_TYPE_WEBSOCKET_REQUEST,
  [grpcRequest.type]: EXPORT_TYPE_GRPC_REQUEST,
  [requestGroup.type]: EXPORT_TYPE_REQUEST_GROUP,
  [unitTestSuite.type]: EXPORT_TYPE_UNIT_TEST_SUITE,
  [unitTest.type]: EXPORT_TYPE_UNIT_TEST,
  [workspace.type]: EXPORT_TYPE_WORKSPACE,
  [cookieJar.type]: EXPORT_TYPE_COOKIE_JAR,
  [environment.type]: EXPORT_TYPE_ENVIRONMENT,
  [apiSpec.type]: EXPORT_TYPE_API_SPEC,
  [protoFile.type]: EXPORT_TYPE_PROTO_FILE,
  [protoDirectory.type]: EXPORT_TYPE_PROTO_DIRECTORY,
}[type] || undefined);

export async function exportWorkspaceData({
  workspaceId,
  dirPath,
}: {
  workspaceId: string;
  dirPath: string;
}) {
  const workspaceToExport = await database.get<Workspace>(workspace.type, workspaceId);
  invariant(workspaceToExport, `Workspace ${workspaceId} not found`);
  const workspaceIds = [workspaceId];

  const getRequestGroups = async ({ $in }: { $in: string[] }): Promise<RequestGroup[]> => {
    const requestGroups = await database.find<RequestGroup>(requestGroup.type, {
      parentId: {
        $in,
      },
    });

    const requestGroupIds = requestGroups.map(requestGroup => requestGroup._id);

    const childRequestGroups = requestGroupIds.length > 0 ? await getRequestGroups({
      $in: requestGroupIds,
    }) : [];

    return [
      ...requestGroups,
      ...childRequestGroups,
    ];
  };

  const allRequestGroups = await getRequestGroups({
    $in: workspaceIds,
  });

  const getProtoDirectories = async ({ $in }: { $in: string[] }): Promise<ProtoDirectory[]> => {
    const protoDirectories = await database.find<ProtoDirectory>(protoDirectory.type, {
      parentId: {
        $in,
      },
    });

    const protoDirectoryIds = protoDirectories.map(protoDirectory => protoDirectory._id);

    const childProtoDirectories = protoDirectoryIds.length > 0 ? await getProtoDirectories({
      $in: protoDirectoryIds,
    }) : [];

    return [
      ...protoDirectories,
      ...childProtoDirectories,
    ];
  };

  const allProtoDirectories = await getProtoDirectories({
    $in: workspaceIds,
  });

  const protoFiles = await database.find<ProtoFile>(protoFile.type, {
    parentId: {
      $in: allProtoDirectories.map(protoDirectory => protoDirectory._id),
    },
  });

  const requests = await database.find<Request>(request.type, {
    parentId: {
      $in: [
        ...workspaceIds,
        ...allRequestGroups.map(requestGroup => requestGroup._id),
      ],
    },
  });

  const grpcRequests = await database.find<GrpcRequest>(grpcRequest.type, {
    parentId: {
      $in: [
        ...workspaceIds,
        ...allRequestGroups.map(requestGroup => requestGroup._id),
      ],
    },
  });

  const webSocketRequests = await database.find<WebSocketRequest>(webSocketRequest.type, {
    parentId: {
      $in: [
        ...workspaceIds,
        ...allRequestGroups.map(requestGroup => requestGroup._id),
      ],
    },
  });

  const baseEnvironments = await database.find<Environment>(environment.type, {
    parentId: {
      $in: workspaceIds,
    },
  });

  const subEnvironments = await database.find<Environment>(environment.type, {
    parentId: {
      $in: baseEnvironments.map(environment => environment._id),
    },
  });

  const allEnvironments = [
    ...baseEnvironments,
    ...subEnvironments,
  ];

  const cookieJars = await database.find<CookieJar>(cookieJar.type, {
    parentId: {
      $in: workspaceIds,
    },
  });

  const apiSpecs = await database.find<ApiSpec>(apiSpec.type, {
    parentId: {
      $in: workspaceIds,
    },
  });

  const unitTestSuites = await database.find<UnitTestSuite>(unitTestSuite.type, {
    parentId: {
      $in: workspaceIds,
    },
  });

  const unitTests = await database.find<UnitTest>(unitTest.type, {
    parentId: {
      $in: unitTestSuites.map(unitTestSuite => unitTestSuite._id),
    },
  });
  const webSocketPayloads = await database.find<WebSocketPayload>(webSocketPayload.type, {
    parentId: {
      $in: webSocketRequests.map(webSocketRequest => webSocketRequest._id),
    },
  });

  const insomniaExport: Insomnia4Data = {
    _type: 'export',
    __export_format: 4,
    __export_date: new Date(),
    __export_source: 'insomnia.desktop.app:v2021.5.0',
    resources: [
      workspaceToExport,
      ...requests,
      ...allRequestGroups,
      ...allEnvironments,
      ...cookieJars,
      ...apiSpecs,
      ...protoFiles,
      ...allProtoDirectories,
      ...unitTests,
      ...unitTestSuites,
      ...webSocketPayloads,
      ...webSocketRequests,
      ...grpcRequests,
    ].map(({ type, ...model }) => ({
      ...model,
      _type: exportTypeByModelType(type),
    })),
  };

  const filePath = join(dirPath, workspaceId + '.json');

  try {
    await writeFile(filePath, JSON.stringify(insomniaExport));
  } catch (error) {
    console.error(error);
  }
}

export async function exportAllData({
  dirPath,
}: {
  dirPath: string;
}): Promise<void> {
  const insomniaExportFolder = join(dirPath, `insomnia-export.${Date.now()}`);
  await mkdir(insomniaExportFolder);

  const workspaces = await database.find<Workspace>(workspace.type);

  for (const workspace of workspaces) {
    await exportWorkspaceData({
      workspaceId: workspace._id,
      dirPath: insomniaExportFolder,
    });
  }
}

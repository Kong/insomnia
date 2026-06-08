import type { KonnectDeploymentType } from 'insomnia-data';

import type { KonnectControlPlane } from '~/konnect/api';

export function getKonnectDeploymentType(controlPlane: KonnectControlPlane): KonnectDeploymentType | null {
  const controlPlaneType = controlPlaneConfigToControlPlaneType({
    cluster_type: controlPlane.config.cluster_type as keyof typeof CLUSTER_TYPE_TO_CP_TYPE_MAP,
    cloud_gateway: controlPlane.config.cloud_gateway,
  });

  switch (controlPlaneType) {
    case ControlPlaneType.K8SIngressController: {
      return null;
    }
    case ControlPlaneType.Cloud: {
      return 'dedicatedCloud';
    }
    case ControlPlaneType.Serverless: {
      return 'serverless';
    }
    case ControlPlaneType.GroupWithCloudDataPlanes:
    case ControlPlaneType.GroupWithOnPremDataPlanes: {
      return 'group';
    }
    case ControlPlaneType.ServerlessV1: {
      return 'serverless';
    }
    default: {
      return 'selfManaged';
    }
  }
}

enum ControlPlaneType {
  Hybrid = 'CONTROL_PLANE_TYPE_HYBRID', // self managed
  Cloud = 'CONTROL_PLANE_TYPE_CLOUD', // Dedicated cloud
  K8SIngressController = 'CONTROL_PLANE_TYPE_K8S_INGRESS_CONTROLLER', // KIC
  /**
   * Group of hybrid-type control planes, on-prem data planes can connect to this control plane group
   */
  GroupWithOnPremDataPlanes = 'CONTROL_PLANE_TYPE_GROUP_WITH_ON_PREM_DATA_PLANES',
  /**
   * Group of hybrid-type control planes, cloud data planes can be created and managed by this control plane group
   */
  GroupWithCloudDataPlanes = 'CONTROL_PLANE_TYPE_GROUP_WITH_CLOUD_DATA_PLANES',
  Serverless = 'CONTROL_PLANE_TYPE_SERVERLESS', // Serverless.v0 deployed on fly.io
  ServerlessV1 = 'CONTROL_PLANE_TYPE_SERVERLESS_V1', // Serverless.v1 (previously HVC)
  // NativeEventProxy = 'CONTROL_PLANE_TYPE_KAFKA_NATIVE_EVENT_PROXY', // KNEP is deprecated in GM, DO NOT add it back
}

const ControlPlaneClusterTypeEnum = {
  ControlPlane: 'CLUSTER_TYPE_CONTROL_PLANE',
  K8SIngressController: 'CLUSTER_TYPE_K8S_INGRESS_CONTROLLER',
  ControlPlaneGroup: 'CLUSTER_TYPE_CONTROL_PLANE_GROUP',
  Serverless: 'CLUSTER_TYPE_SERVERLESS',
  HttpGateway: 'CLUSTER_TYPE_HTTP_GATEWAY',
  EventGateway: 'CLUSTER_TYPE_EVENT_GATEWAY',
  KafkaNativeEventProxy: 'CLUSTER_TYPE_KAFKA_NATIVE_EVENT_PROXY',
  CloudApiGateway: 'CLUSTER_TYPE_CLOUD_API_GATEWAY',
  ServerlessV1: 'CLUSTER_TYPE_SERVERLESS_V1',
};

const CLUSTER_TYPE_TO_CP_TYPE_MAP = {
  [ControlPlaneClusterTypeEnum.ControlPlane]: { false: ControlPlaneType.Hybrid, true: ControlPlaneType.Cloud },
  [ControlPlaneClusterTypeEnum.K8SIngressController]: { false: ControlPlaneType.K8SIngressController },
  [ControlPlaneClusterTypeEnum.ControlPlaneGroup]: {
    false: ControlPlaneType.GroupWithOnPremDataPlanes,
    true: ControlPlaneType.GroupWithCloudDataPlanes,
  },
  [ControlPlaneClusterTypeEnum.Serverless]: { false: ControlPlaneType.Serverless },
  [ControlPlaneClusterTypeEnum.ServerlessV1]: { true: ControlPlaneType.ServerlessV1 },
  // Placeholders for other cluster types
  [ControlPlaneClusterTypeEnum.CloudApiGateway]: { true: ControlPlaneType.ServerlessV1 }, // TODO: remove this when CLUSTER_TYPE_SERVERLESS_V1 is accepted by the API (KHCP-19640)
  [ControlPlaneClusterTypeEnum.HttpGateway]: { false: null },
  [ControlPlaneClusterTypeEnum.EventGateway]: { false: null },
  [ControlPlaneClusterTypeEnum.KafkaNativeEventProxy]: { false: null }, // KNEP is deprecated, DO NOT map it to any CP type
} as const;

type ControlPlaneConfigToControlPlaneType<
  T extends keyof typeof CLUSTER_TYPE_TO_CP_TYPE_MAP,
  C extends boolean,
> = `${C}` extends keyof (typeof CLUSTER_TYPE_TO_CP_TYPE_MAP)[T]
  ? (typeof CLUSTER_TYPE_TO_CP_TYPE_MAP)[T][`${C}`]
  : never;

type NeverToNull<T> = T extends never ? null : T;

function controlPlaneConfigToControlPlaneType<
  T extends keyof typeof CLUSTER_TYPE_TO_CP_TYPE_MAP,
  C extends boolean,
>(config: { cluster_type: T; cloud_gateway: C }): NeverToNull<ControlPlaneConfigToControlPlaneType<T, C>> {
  type ReturnType = NeverToNull<ControlPlaneConfigToControlPlaneType<T, C>>;
  const { cluster_type: clusterType, cloud_gateway: isCloudGateway } = config;
  const subMap = CLUSTER_TYPE_TO_CP_TYPE_MAP[clusterType];
  if (subMap && Object.hasOwnProperty.call(subMap, `${isCloudGateway}`)) {
    return subMap[`${isCloudGateway}` as keyof typeof subMap] as ReturnType;
  }
  // this should never happen, but just in case
  console.error(
    `ControlPlaneConfigToControlPlaneType: invalid clusterType ${clusterType} or cloud_gateway ${isCloudGateway}`,
  );

  return null as ReturnType;
}

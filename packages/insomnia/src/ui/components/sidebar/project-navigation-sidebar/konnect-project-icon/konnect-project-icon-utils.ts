import type { KonnectDeploymentType } from 'insomnia-data';

import type { KonnectControlPlane } from '~/konnect/api';

const clusterTypeToIcon: Partial<Record<string, KonnectDeploymentType>> = {
  CLUSTER_TYPE_K8S_INGRESS_CONTROLLER: 'selfManaged',
  CLUSTER_TYPE_SERVERLESS_V1: 'serverless',
  CLUSTER_TYPE_SERVERLESS: 'serverless',
  CLUSTER_TYPE_CLOUD_API_GATEWAY: 'dedicatedCloud',
  CLUSTER_TYPE_CONTROL_PLANE_GROUP: 'group',
};

export function getKonnectDeploymentType(controlPlane: KonnectControlPlane): KonnectDeploymentType | null {
  try {
    const {
      config: { cluster_type, cloud_gateway },
    } = controlPlane;
    if (cluster_type === 'CLUSTER_TYPE_CONTROL_PLANE') {
      return cloud_gateway ? 'dedicatedCloud' : 'selfManaged';
    }
    return clusterTypeToIcon[cluster_type] ?? null;
  } catch {
    return null;
  }
}

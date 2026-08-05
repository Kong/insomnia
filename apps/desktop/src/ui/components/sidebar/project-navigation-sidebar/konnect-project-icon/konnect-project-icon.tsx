import type { KonnectDeploymentType } from 'insomnia-data';

import { Icon } from '../../../icon';
import dedicatedCloudIcon from './dedicated-cloud.svg';
import groupIcon from './group.svg';
import k8sIngressControllerIcon from './k8s-ingress-controller.svg';
import selfManagedIcon from './self-managed.svg';
import serverlessIcon from './serverless.svg';

const konnectDeploymentTypeToIcon: Record<KonnectDeploymentType, string> = {
  selfManaged: selfManagedIcon,
  serverless: serverlessIcon,
  dedicatedCloud: dedicatedCloudIcon,
  group: groupIcon,
  k8sIngressController: k8sIngressControllerIcon,
};

export const KonnectProjectIcon = ({
  konnectDeploymentType,
}: {
  konnectDeploymentType?: KonnectDeploymentType | null;
}) => {
  const icon = konnectDeploymentType ? konnectDeploymentTypeToIcon[konnectDeploymentType] : undefined;
  if (!icon) {
    return <Icon icon="laptop" />;
  }
  return <img src={icon} alt="" className="h-5 w-5" />;
};

import type { IconProp } from '@fortawesome/fontawesome-svg-core';

import { Icon } from '~/basic-components/icon';
import { models } from '~/insomnia-data';
import { getMethodShortHand, RequestBadge } from '~/ui/components/tags/method-tag';

export function ResourceIcon({ resource }: { resource: any }) {
  const isProject = models.project.isProject(resource);
  let icon: IconProp | null = null;
  if (isProject) {
    icon = models.project.isRemoteProject(resource)
      ? 'globe-americas'
      : models.project.isGitProject(resource)
        ? ['fab', 'git-alt']
        : 'laptop';
  }
  const isWorkspace = models.workspace.isWorkspace(resource);
  if (isWorkspace) {
    icon =
      ({
        'design': 'file',
        'collection': 'bars',
        'mock-server': 'server',
        'environment': 'code',
        'mcp': ['fac', 'mcp'],
      }[resource.scope] as IconProp) || null;
  }

  if (models.requestGroup.isRequestGroup(resource)) {
    icon = 'folder';
  }

  if (icon) {
    return <Icon icon={icon} className="w-3 shrink-0" />;
  }
  return (
    <>
      {models.request.isRequest(resource) && <RequestBadge label={getMethodShortHand(resource)} colorKey={resource.method} />}
      {models.webSocketRequest.isWebSocketRequest(resource) && <RequestBadge label="WS" colorKey="WS" />}
      {models.socketIORequest.isSocketIORequest(resource) && <RequestBadge label="IO" colorKey="IO" />}
      {models.grpcRequest.isGrpcRequest(resource) && <RequestBadge label="gRPC" colorKey="gRPC" />}
    </>
  );
}

import type { IconProp } from '@fortawesome/fontawesome-svg-core';

import { Icon } from '~/basic-components/icon';
import { models } from '~/insomnia-data';
import { getMethodShortHand, getRequestBadgeClassName } from '~/ui/components/tags/method-tag';

export const getBadgeClassName = (colorKey: string) =>
  `flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) text-[0.65rem] ${getRequestBadgeClassName(colorKey)}`;

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
      {models.request.isRequest(resource) && (
        <span className={getBadgeClassName(resource.method)}>{getMethodShortHand(resource)}</span>
      )}
      {models.webSocketRequest.isWebSocketRequest(resource) && <span className={getBadgeClassName('WS')}>WS</span>}
      {models.socketIORequest.isSocketIORequest(resource) && <span className={getBadgeClassName('IO')}>IO</span>}
      {models.grpcRequest.isGrpcRequest(resource) && <span className={getBadgeClassName('gRPC')}>gRPC</span>}
    </>
  );
}

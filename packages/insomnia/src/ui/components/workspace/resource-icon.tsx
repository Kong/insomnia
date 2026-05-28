import type { IconProp } from '@fortawesome/fontawesome-svg-core';

import { Icon } from '~/basic-components/icon';
import { models } from '~/insomnia-data';
import { getMethodShortHand } from '~/ui/components/tags/method-tag';

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
        <span
          className={`flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) text-[0.65rem] ${
            {
              GET: 'bg-[rgba(var(--color-surprise-rgb),0.5)] text-(--color-font-surprise)',
              POST: 'bg-[rgba(var(--color-success-rgb),0.5)] text-(--color-font-success)',
              HEAD: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
              OPTIONS: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
              DELETE: 'bg-[rgba(var(--color-danger-rgb),0.5)] text-(--color-font-danger)',
              PUT: 'bg-[rgba(var(--color-warning-rgb),0.5)] text-(--color-font-warning)',
              PATCH: 'bg-[rgba(var(--color-notice-rgb),0.5)] text-(--color-font-notice)',
            }[resource.method] || 'bg-(--hl-md) text-(--color-font)'
          }`}
        >
          {getMethodShortHand(resource)}
        </span>
      )}
      {models.webSocketRequest.isWebSocketRequest(resource) && (
        <span className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-[rgba(var(--color-notice-rgb),0.5)] text-[0.65rem] text-(--color-font-notice)">
          WS
        </span>
      )}
      {models.socketIORequest.isSocketIORequest(resource) && (
        <span className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-[rgba(var(--color-notice-rgb),0.5)] text-[0.65rem] text-(--color-font-notice)">
          IO
        </span>
      )}
      {models.grpcRequest.isGrpcRequest(resource) && (
        <span className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-[rgba(var(--color-info-rgb),0.5)] text-[0.65rem] text-(--color-font-info)">
          gRPC
        </span>
      )}
    </>
  );
}

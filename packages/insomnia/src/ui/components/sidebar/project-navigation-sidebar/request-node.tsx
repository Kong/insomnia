import { useState } from 'react';
import { Button } from 'react-aria-components';

import type { GrpcRequest, McpRequest, Request, SocketIORequest, WebSocketRequest } from '~/insomnia-data';
import { models } from '~/insomnia-data';
import { RequestActionsDropdown } from '~/ui/components/dropdowns/request-actions-dropdown';
import { RequestGroupActionsDropdown } from '~/ui/components/dropdowns/request-group-actions-dropdown';
import type { CollectionChildFlatItem } from '~/ui/components/sidebar/project-navigation-sidebar/types';
import { getMethodShortHand, getRequestMethodShortHand } from '~/ui/components/tags/method-tag';

import { Icon } from '../../icon';
import {
  ACTIVE_BORDER_CLASS,
  GUIDE_LINE_CSS,
  ICON_CLASS,
  ROW_CLASS,
  TOGGLE_BTN_CLASS,
} from './project-navigation-sidebar-utils';

function MethodBadge({ doc }: { doc: Request | WebSocketRequest | GrpcRequest | SocketIORequest | McpRequest }) {
  if (models.request.isRequest(doc)) {
    const methodColorMap: Record<string, string> = {
      GET: 'bg-[rgba(var(--color-surprise-rgb),0.5)] text-(--color-font-surprise)',
      POST: 'bg-[rgba(var(--color-success-rgb),0.5)] text-(--color-font-success)',
      HEAD: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
      OPTIONS: 'bg-[rgba(var(--color-info-rgb),0.5)] text-(--color-font-info)',
      DELETE: 'bg-[rgba(var(--color-danger-rgb),0.5)] text-(--color-font-danger)',
      PUT: 'bg-[rgba(var(--color-warning-rgb),0.5)] text-(--color-font-warning)',
      PATCH: 'bg-[rgba(var(--color-notice-rgb),0.5)] text-(--color-font-notice)',
    };
    return (
      <span
        className={`flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) text-[0.65rem] ${methodColorMap[doc.method] || 'bg-(--hl-md) text-(--color-font)'}`}
      >
        {getMethodShortHand(doc)}
      </span>
    );
  }
  const docShortHand = getRequestMethodShortHand(doc);
  if (models.webSocketRequest.isWebSocketRequest(doc)) {
    return (
      <span className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-[rgba(var(--color-notice-rgb),0.5)] text-[0.65rem] text-(--color-font-notice)">
        {docShortHand}
      </span>
    );
  }
  if (models.socketIORequest.isSocketIORequest(doc)) {
    return (
      <span className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-[rgba(var(--color-notice-rgb),0.5)] text-[0.65rem] text-(--color-font-notice)">
        {docShortHand}
      </span>
    );
  }
  if (models.grpcRequest.isGrpcRequest(doc)) {
    return (
      <span className="flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) bg-[rgba(var(--color-info-rgb),0.5)] text-[0.65rem] text-(--color-font-info)">
        {docShortHand}
      </span>
    );
  }
  return null;
}

interface RequestNodeProps {
  item: CollectionChildFlatItem;
  onToggleFolder: (requestGroupIds: string[]) => void;
}

export const RequestNode = ({ item, onToggleFolder }: RequestNodeProps) => {
  const { doc, level, workspace, project, collapsed } = item;

  const isFolder = models.requestGroup.isRequestGroup(doc);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);

  return (
    <div className={ROW_CLASS} style={{ paddingLeft: `${level + 3}rem` }}>
      {Array.from({ length: level + 2 }, (_, i) => {
        const isActive = i === level + 1;
        return (
          <span
            key={i}
            className={`${GUIDE_LINE_CSS} group-hover/tree:bg-(--hl-sm) ${isActive ? 'group-hover:bg-(--hl-sm)' : ''}`}
            style={{ left: `${i + 1.5}em` }}
          />
        );
      })}
      <span className={ACTIVE_BORDER_CLASS} />
      <Button
        aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${doc.name}`}
        onPress={() => isFolder && onToggleFolder([doc._id])}
        className={TOGGLE_BTN_CLASS}
      >
        {isFolder ? <Icon icon={collapsed ? 'chevron-right' : 'chevron-down'} className={ICON_CLASS} /> : null}
      </Button>

      {isFolder ? (
        <Icon icon="folder" className={ICON_CLASS} />
      ) : (
        <>
          <MethodBadge doc={doc} />
        </>
      )}
      <span className="flex-1 truncate text-sm">
        {doc.name || (models.request.isRequest(doc) ? doc.url : '') || 'Untitled'}
      </span>
      {models.requestGroup.isRequestGroup(doc) ? (
        <RequestGroupActionsDropdown
          requestGroup={doc}
          // TODO support rename for request group
          onRename={() => {}}
          activeProject={project}
          activeWorkspace={workspace}
          isOpen={isContextMenuOpen}
          onOpenChange={setIsContextMenuOpen}
        />
      ) : (
        <RequestActionsDropdown
          request={doc}
          // TODO support rename for request actions
          onRename={() => {}}
          activeProject={project}
          activeWorkspace={workspace}
          isPinned={item.pinned}
          isOpen={isContextMenuOpen}
          onOpenChange={setIsContextMenuOpen}
        />
      )}
    </div>
  );
};

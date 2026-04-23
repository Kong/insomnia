import { set } from 'date-fns';
import { useState } from 'react';
import { Button } from 'react-aria-components';

import type {
  GrpcRequest,
  McpRequest,
  Request,
  RequestGroup,
  SocketIORequest,
  WebSocketRequest,
  Workspace,
} from '~/insomnia-data';
import { models } from '~/insomnia-data';
import { RequestActionsDropdown } from '~/ui/components/dropdowns/request-actions-dropdown';
import { RequestGroupActionsDropdown } from '~/ui/components/dropdowns/request-group-actions-dropdown';
import { EditableInput } from '~/ui/components/editable-input';
import { showModal } from '~/ui/components/modals';
import { PromptModal } from '~/ui/components/modals/prompt-modal';
import type { CollectionChildFlatItem } from '~/ui/components/sidebar/project-navigation-sidebar/types';
import { getMethodShortHand, getRequestMethodShortHand } from '~/ui/components/tags/method-tag';
import { useRequestGroupPatcher, useRequestPatcher } from '~/ui/hooks/use-request';

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

const getRequestNameOrFallback = (
  doc: Request | RequestGroup | GrpcRequest | WebSocketRequest | SocketIORequest,
): string => {
  return !models.requestGroup.isRequestGroup(doc)
    ? doc.name || doc.url || 'Untitled request'
    : doc.name || 'Untitled folder';
};

interface RequestNodeProps {
  item: CollectionChildFlatItem;
  onToggleFolder: (requestGroupIds: string[], workspace: Workspace) => void;
}

export const RequestNode = ({ item, onToggleFolder }: RequestNodeProps) => {
  const { doc, level, workspace, project, collapsed } = item;

  const patchRequest = useRequestPatcher();
  const patchGroup = useRequestGroupPatcher();
  const isFolder = models.requestGroup.isRequestGroup(doc);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [isEditable, setIsEditable] = useState(false);

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
        onPress={() => isFolder && onToggleFolder([doc._id], workspace)}
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
      <EditableInput
        value={getRequestNameOrFallback(doc)}
        name="request name"
        ariaLabel="request name"
        className="flex-1 px-1 text-sm"
        onEditableChange={editable => setIsEditable(editable)}
        onSubmit={newName => {
          if (models.requestGroup.isRequestGroup(doc)) {
            patchGroup(doc._id, { name: newName });
          } else {
            patchRequest(doc._id, { name: newName });
          }
        }}
      />
      {models.requestGroup.isRequestGroup(doc) && !isEditable && (
        <RequestGroupActionsDropdown
          requestGroup={doc}
          onRename={() =>
            showModal(PromptModal, {
              title: `Rename ${getRequestNameOrFallback(doc)}`,
              defaultValue: getRequestNameOrFallback(doc),
              submitName: 'Rename',
              selectText: true,
              label: 'Name',
              onComplete: newName => patchGroup(doc._id, { name: newName }),
            })
          }
          activeProject={project}
          activeWorkspace={workspace}
          isOpen={isContextMenuOpen}
          onOpenChange={setIsContextMenuOpen}
        />
      )}
      {!models.requestGroup.isRequestGroup(doc) && !isEditable && (
        <RequestActionsDropdown
          request={doc}
          onRename={() =>
            showModal(PromptModal, {
              title: `Rename ${getRequestNameOrFallback(doc)}`,
              defaultValue: getRequestNameOrFallback(doc),
              submitName: 'Rename',
              selectText: true,
              label: 'Name',
              onComplete: newName => patchRequest(doc._id, { name: newName }),
            })
          }
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

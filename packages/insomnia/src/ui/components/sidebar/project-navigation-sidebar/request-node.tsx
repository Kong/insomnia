import { useState } from 'react';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';
import { useParams } from 'react-router';

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
import type {
  CollectionChildFlatItem,
  PinnedRequestFlatItem,
} from '~/ui/components/sidebar/project-navigation-sidebar/types';
import { getMethodShortHand, getRequestMethodShortHand } from '~/ui/components/tags/method-tag';
import { useExecutionState } from '~/ui/hooks/use-execution-state';
import { useReadyState } from '~/ui/hooks/use-ready-state';
import { useRequestGroupPatcher, useRequestMetaPatcher, useRequestPatcher } from '~/ui/hooks/use-request';

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

const WebSocketSpinner = ({ requestId }: { requestId: string }) => {
  const readyState = useReadyState({ requestId, protocol: 'webSocket' });
  return readyState ? (
    <div
      className="mr-(--padding-sm) h-2.5 w-2.5 shrink-0 rounded-full bg-(--color-success)"
      data-testid="WebSocketSpinner__Connected"
    />
  ) : null;
};

const SocketIOSpinner = ({ requestId }: { requestId: string }) => {
  const readyState = useReadyState({ requestId, protocol: 'socketIO' });
  return readyState ? (
    <div
      className="mr-(--padding-sm) h-2.5 w-2.5 shrink-0 rounded-full bg-(--color-success)"
      data-testid="SocketIOSpinner__Connected"
    />
  ) : null;
};

const EventStreamSpinner = ({ requestId }: { requestId: string }) => {
  const readyState = useReadyState({ requestId, protocol: 'curl' });
  return readyState ? (
    <div
      className="mr-(--padding-sm) h-2.5 w-2.5 shrink-0 rounded-full bg-(--color-success)"
      data-testid="EventStreamSpinner__Connected"
    />
  ) : null;
};

const RequestTiming = ({ requestId }: { requestId: string }) => {
  const { isExecuting } = useExecutionState({ requestId });
  return isExecuting ? (
    <div
      className="mr-(--padding-sm) h-2.5 w-2.5 shrink-0 rounded-full bg-(--color-success)"
      data-testid="WebSocketSpinner__Connected"
    />
  ) : null;
};

const getRequestNameOrFallback = (
  doc: Request | RequestGroup | GrpcRequest | WebSocketRequest | SocketIORequest,
): string => {
  return !models.requestGroup.isRequestGroup(doc)
    ? doc.name || doc.url || 'Untitled request'
    : doc.name || 'Untitled folder';
};

interface RequestNodeProps {
  item: CollectionChildFlatItem | PinnedRequestFlatItem;
  onToggleFolder: (requestGroupIds: string[], workspace: Workspace) => void;
  className?: string;
}

export const RequestNode = ({ item, onToggleFolder, className }: RequestNodeProps) => {
  const { doc, level: requestLevel, workspace, project, collapsed, pinned, kind } = item;
  const isPinnedRequest = kind === 'pinnedRequest';
  const isLastPinned = item.kind === 'pinnedRequest' && item.isLastPinned;

  const workspaceId = workspace._id;
  const patchRequest = useRequestPatcher(workspaceId);
  const patchGroup = useRequestGroupPatcher(workspaceId);
  const patchRequestMeta = useRequestMetaPatcher(workspaceId);
  const isFolder = models.requestGroup.isRequestGroup(doc);
  const [isContextMenuOpen, setIsContextMenuOpen] = useState(false);
  const [isEditable, setIsEditable] = useState(false);
  // Pinned requests are always shown at the top level of the sidebar, so we set their level to 0.
  const level = isPinnedRequest ? 0 : requestLevel;
  const params = useParams() as { requestId?: string; requestGroupId?: string };
  const isSelected = item.doc._id === params.requestId || item.doc._id === params.requestGroupId;

  const content = (
    <>
      <Button slot="drag" className="hidden" />
      {!isPinnedRequest && (
        <Button
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${doc.name}`}
          onPress={() => isFolder && onToggleFolder([doc._id], workspace)}
          className={TOGGLE_BTN_CLASS}
        >
          {isFolder ? <Icon icon={collapsed ? 'chevron-right' : 'chevron-down'} className={ICON_CLASS} /> : null}
        </Button>
      )}
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-xs px-2 py-1 text-left transition-colors">
        {isFolder ? <Icon icon="folder" className={ICON_CLASS} /> : <MethodBadge doc={doc} />}
        <EditableInput
          value={getRequestNameOrFallback(doc)}
          name="request name"
          ariaLabel={getRequestNameOrFallback(doc)}
          className="flex-1 text-base hover:bg-transparent!"
          onEditableChange={editable => setIsEditable(editable)}
          onSubmit={newName => {
            if (models.requestGroup.isRequestGroup(doc)) {
              patchGroup(doc._id, { name: newName });
            } else {
              patchRequest(doc._id, { name: newName });
            }
          }}
        />
      </div>
      {models.webSocketRequest.isWebSocketRequest(item.doc) && <WebSocketSpinner requestId={item.doc._id} />}
      {models.socketIORequest.isSocketIORequest(item.doc) && <SocketIOSpinner requestId={item.doc._id} />}
      {models.request.isGraphqlSubscriptionRequest(item.doc) && <WebSocketSpinner requestId={item.doc._id} />}
      {models.request.isRequest(item.doc) && <RequestTiming requestId={item.doc._id} />}
      {models.request.isEventStreamRequest(item.doc) && <EventStreamSpinner requestId={item.doc._id} />}
      {!models.requestGroup.isRequestGroup(doc) && pinned && !isPinnedRequest && (
        <TooltipTrigger>
          <Button
            aria-label="Unpin request"
            className="flex aspect-square h-6 items-center justify-center rounded-xs text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:ring-(--hl-md) focus:outline-hidden focus:ring-inset aria-pressed:bg-(--hl-sm)"
            onPress={() => patchRequestMeta(item.doc._id, { pinned: false })}
          >
            <Icon icon="thumb-tack" />
          </Button>
          <Tooltip
            offset={8}
            className="rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-2 py-1 text-base text-(--color-font) shadow-lg select-none focus:outline-hidden"
          >
            Unpin Request
          </Tooltip>
        </TooltipTrigger>
      )}
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
    </>
  );

  return (
    <div
      className={`${ROW_CLASS} ${className ?? ''} ${isPinnedRequest ? 'h-full! group-hover:bg-transparent! group-focus:bg-transparent!' : ''}`}
      style={{ paddingLeft: `${level + 3}rem` }}
      data-testid={
        isPinnedRequest
          ? `pinned-request-node-${getRequestNameOrFallback(doc)}`
          : `request-node-${getRequestNameOrFallback(doc)}`
      }
      data-project={project.name}
      data-workspace={workspace.name}
      data-selected={isSelected}
    >
      {isPinnedRequest ? (
        <>
          <span className={`${GUIDE_LINE_CSS} left-6 group-hover/tree:bg-(--hl-sm)`} />
          <span className={`${GUIDE_LINE_CSS} left-10 group-hover/tree:bg-(--hl-sm)`} />
        </>
      ) : (
        Array.from({ length: level + 2 }, (_, i) => {
          const isActive = i === level + 1;
          return (
            <span
              key={i}
              className={`${GUIDE_LINE_CSS} group-hover/tree:bg-(--hl-sm) ${isActive ? 'group-hover:bg-(--hl-sm)' : ''}`}
              style={{ left: `${i + 1.5}em` }}
            />
          );
        })
      )}
      <span className={ACTIVE_BORDER_CLASS} />
      {isPinnedRequest ? (
        <div
          className={`ml-1 flex min-w-0 flex-1 items-center self-stretch overflow-hidden border-x border-solid border-(--hl-md) bg-(--hl-xs) pr-2 group-hover:bg-(--hl-sm) group-focus:bg-(--hl-sm) ${isLastPinned ? 'rounded-b-sm border-b' : ''}`}
        >
          {content}
        </div>
      ) : (
        content
      )}
    </div>
  );
};

export const PinnedHeaderNode = () => {
  return (
    <div
      className={`${ROW_CLASS} group h-full! pl-12 group-hover:bg-transparent!`}
      data-testid="pinned-requests-header"
    >
      <Button slot="drag" className="hidden" />
      <span className={`${GUIDE_LINE_CSS} left-6 group-hover/tree:bg-(--hl-sm)`} />
      <span className={`${GUIDE_LINE_CSS} left-10 group-hover/tree:bg-(--hl-sm)`} />
      <div className="ml-1 flex w-full items-center self-stretch rounded-t-sm border border-b-0 border-solid border-(--hl-md) bg-(--hl-xs) px-2 pt-1 text-(--hl)">
        <Icon icon="thumb-tack" className="h-4 w-4 shrink-0" />
        <span className="ml-1 text-base">Pinned</span>
      </div>
    </div>
  );
};

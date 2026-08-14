import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import type { FC, ReactNode } from 'react';
import { Button } from 'react-aria-components';

import { Icon } from '../../icon';
import type { EntityChangeStatus, VisualDiffEntityType } from './diff-engine';

const ENTITY_TYPE_LABELS: Record<VisualDiffEntityType, string> = {
  request: 'Request',
  grpc_request: 'gRPC Request',
  websocket_request: 'WebSocket Request',
  socketio_request: 'Socket.IO Request',
  request_group: 'Folder',
  environment: 'Environment',
  mock_route: 'Mock Route',
  mcp_request: 'MCP Request',
  cookie_jar: 'Cookie Jar',
  unknown: 'Item',
};

export function entityTypeLabel(type: VisualDiffEntityType): string {
  return ENTITY_TYPE_LABELS[type] ?? 'Item';
}

const STATUS_STYLES: Record<EntityChangeStatus, { className: string; icon: IconProp; label: string }> = {
  added: { className: 'bg-(--color-success)/20 text-(--color-font-success)', icon: 'plus', label: 'Added' },
  removed: { className: 'bg-(--color-danger)/20 text-(--color-font-danger)', icon: 'minus', label: 'Removed' },
  modified: { className: 'bg-(--color-notice)/20 text-(--color-font-notice)', icon: 'pencil', label: 'Modified' },
};

export const StatusBadge: FC<{ status: EntityChangeStatus }> = ({ status }) => {
  const { className, icon, label } = STATUS_STYLES[status];
  return (
    <span className={`flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-xs font-medium ${className}`}>
      <Icon icon={icon} /> {label}
    </span>
  );
};

// Props every visual diff card accepts for its per-entity stage/unstage button.
export interface EntityCardActionProps {
  staged: boolean;
  isPending: boolean;
  onStage: () => void;
}

// Groups the status badge with the per-entity stage/unstage action, shown at
// the top-right of every visual diff card.
export const CardHeaderActions: FC<{ status: EntityChangeStatus } & EntityCardActionProps> = ({
  status,
  staged,
  isPending,
  onStage,
}) => (
  <div className="flex shrink-0 items-center gap-2">
    <StatusBadge status={status} />
    <Button
      isDisabled={isPending}
      onPress={onStage}
      className="flex items-center gap-1 rounded-xs bg-(--hl-xs) px-2 py-1 text-xs font-medium text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-sm) focus:ring-(--hl-md) focus:ring-inset disabled:opacity-50"
    >
      <Icon icon={isPending ? 'spinner' : staged ? 'minus' : 'plus'} className={isPending ? 'animate-spin' : ''} />
      {staged ? 'Unstage' : 'Stage'}
    </Button>
  </div>
);

export const DiffCardShell: FC<{ status: EntityChangeStatus; children: ReactNode }> = ({ status, children }) => {
  const borderColor =
    status === 'added'
      ? 'border-l-(--color-success)'
      : status === 'removed'
        ? 'border-l-(--color-danger)'
        : 'border-l-(--color-notice)';
  return (
    <div className={`flex flex-col gap-2 rounded-xs border border-solid border-(--hl-sm) border-l-2 bg-(--hl-xs) p-3 ${borderColor}`}>
      {children}
    </div>
  );
};

export function formatValue(value: unknown): string {
  if (value === undefined) {
    return '—';
  }
  if (value === null || value === '') {
    return '(empty)';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'boolean' || typeof value === 'number') {
    return String(value);
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

// Lays before/after side-by-side when there's room for both (flex-wrap falls
// back to stacked once the combined width no longer fits the container).
export const ValueChange: FC<{ before: unknown; after: unknown }> = ({ before, after }) => {
  const hasBefore = before !== undefined;
  const hasAfter = after !== undefined;
  return (
    <div className="flex flex-wrap items-start gap-2 text-sm">
      {hasBefore && (
        <pre className="min-w-40 flex-1 overflow-x-auto rounded-xs bg-(--color-danger)/10 px-2 py-1 whitespace-pre-wrap text-(--color-font-danger) line-through">
          {formatValue(before)}
        </pre>
      )}
      {hasAfter && (
        <pre className="min-w-40 flex-1 overflow-x-auto rounded-xs bg-(--color-success)/10 px-2 py-1 whitespace-pre-wrap text-(--color-font-success)">
          {formatValue(after)}
        </pre>
      )}
    </div>
  );
};

export const FieldDiffRow: FC<{ label: string; before: unknown; after: unknown }> = ({ label, before, after }) => (
  <div className="flex flex-col gap-1">
    <span className="text-xs text-(--hl)">{label}</span>
    <ValueChange before={before} after={after} />
  </div>
);

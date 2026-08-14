import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import type { FC, ReactNode } from 'react';

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

export const ValueChange: FC<{ before: unknown; after: unknown }> = ({ before, after }) => {
  const hasBefore = before !== undefined;
  const hasAfter = after !== undefined;
  return (
    <div className="flex flex-col gap-1 text-sm">
      {hasBefore && (
        <pre className="overflow-x-auto rounded-xs bg-(--color-danger)/10 px-2 py-1 whitespace-pre-wrap text-(--color-font-danger) line-through">
          {formatValue(before)}
        </pre>
      )}
      {hasAfter && (
        <pre className="overflow-x-auto rounded-xs bg-(--color-success)/10 px-2 py-1 whitespace-pre-wrap text-(--color-font-success)">
          {formatValue(after)}
        </pre>
      )}
    </div>
  );
};

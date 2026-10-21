import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import type { FC, ReactNode } from 'react';
import { Button } from 'react-aria-components';

import { Icon } from '../../icon';
import type { EntityChangeStatus, VisualDiffEntityType } from './diff-engine';
import { InlineDiffEditor } from './inline-diff-editor';

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
  workspace: 'Workspace',
  mock_server: 'Mock Server',
  api_spec: 'API Spec',
  unit_tests: 'Unit Tests',
  ca_certificates: 'CA Certificates',
  unknown: 'Item',
};

export function entityTypeLabel(type: VisualDiffEntityType): string {
  return ENTITY_TYPE_LABELS[type] ?? 'Item';
}

const STATUS_STYLES: Record<EntityChangeStatus, { className: string; dotClassName: string; icon: IconProp; label: string }> = {
  added: {
    className: 'bg-(--color-success)/20 text-(--color-font)',
    dotClassName: 'bg-(--color-success)',
    icon: 'plus',
    label: 'Added',
  },
  removed: {
    className: 'bg-(--color-danger)/20 text-(--color-font)',
    dotClassName: 'bg-(--color-danger)',
    icon: 'minus',
    label: 'Removed',
  },
  modified: {
    className: 'bg-(--color-notice)/20 text-(--color-font)',
    dotClassName: 'bg-(--color-notice)',
    icon: 'pencil',
    label: 'Modified',
  },
};

export const StatusBadge: FC<{ status: EntityChangeStatus }> = ({ status }) => {
  const { className, icon, label } = STATUS_STYLES[status];
  return (
    <span className={`flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-xs font-medium ${className}`}>
      <Icon icon={icon} /> {label}
    </span>
  );
};

// Small colored dot conveying a section's dominant change status — used on tab
// labels and chips, where a full StatusBadge would be too heavy.
export const StatusDot: FC<{ status: EntityChangeStatus }> = ({ status }) => (
  <span className={`inline-block size-2 shrink-0 rounded-full ${STATUS_STYLES[status].dotClassName}`} />
);

// Compact pill summarizing one changed section (eg. "Headers 2") — shown in a
// card's collapsed state as a stand-in for the section's (hidden) tab, and
// clickable to expand straight into that tab.
export const ChangeChip: FC<{ label: string; status: EntityChangeStatus; count?: number; onPress?: () => void }> = ({
  label,
  status,
  count,
  onPress,
}) => {
  const content = (
    <span className="flex items-center gap-1.5 rounded-full bg-(--color-bg) px-2 py-0.5 text-xs font-medium text-(--color-font)">
      <StatusDot status={status} />
      {label}
      {count !== undefined && count > 0 && <span className="text-(--hl)">{count}</span>}
    </span>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Button
      onPress={onPress}
      className="cursor-pointer rounded-full ring-1 ring-transparent transition-all hover:brightness-110 focus:ring-(--hl-md) focus:ring-inset"
    >
      {content}
    </Button>
  );
};

// Chevron toggle for a card's collapsed/expanded state.
export const CollapseToggleButton: FC<{ isExpanded: boolean; onPress: () => void }> = ({ isExpanded, onPress }) => (
  <Button
    onPress={onPress}
    aria-label={isExpanded ? 'Collapse' : 'Expand'}
    className="flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-sm text-(--hl) ring-1 ring-transparent transition-all hover:bg-(--hl-sm) hover:text-(--color-font) focus:ring-(--hl-md) focus:ring-inset"
  >
    <Icon icon={isExpanded ? 'chevron-down' : 'chevron-right'} />
  </Button>
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

// Past this a value is hard to compare by eye as two whole blocks.
const LONG_VALUE_LENGTH = 120;

function isLongValue(text: string) {
  return text.includes('\n') || text.length > LONG_VALUE_LENGTH;
}

// Objects are shown as JSON, and so are strings holding a JSON document (eg. a request body).
function diffLanguage(value: unknown, text: string) {
  if (typeof value === 'object') {
    return 'json';
  }
  if (!/^\s*[[{]/.test(text)) {
    return 'plaintext';
  }
  try {
    JSON.parse(text);
    return 'json';
  } catch {
    return 'plaintext';
  }
}

// A long value changed on both sides gets a highlighted diff, so the changed parts stand out.
// Otherwise before/after are laid side-by-side when there's room for both (flex-wrap falls back
// to stacked once the combined width no longer fits the container). Either way a long value
// scrolls inside a capped height (as `InlineDiffEditor` does), so one value can't stretch the card.
export const ValueChange: FC<{ before: unknown; after: unknown }> = ({ before, after }) => {
  const hasBefore = before !== undefined;
  const hasAfter = after !== undefined;
  if (hasBefore && hasAfter) {
    const original = formatValue(before);
    const modified = formatValue(after);
    if (isLongValue(original) || isLongValue(modified)) {
      return <InlineDiffEditor original={original} modified={modified} language={diffLanguage(after, modified)} />;
    }
  }
  return (
    <div className="flex flex-wrap items-start gap-2 text-sm">
      {hasBefore && (
        <pre className="max-h-96 min-w-40 flex-1 overflow-auto rounded-xs bg-(--color-danger)/10 px-2 py-1 whitespace-pre-wrap text-(--color-font) line-through">
          {formatValue(before)}
        </pre>
      )}
      {hasAfter && (
        <pre className="max-h-96 min-w-40 flex-1 overflow-auto rounded-xs bg-(--color-success)/10 px-2 py-1 whitespace-pre-wrap text-(--color-font)">
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

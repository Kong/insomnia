import type { RequestTestResult } from 'insomnia-data';

import { RESPONSE_CODE_REASONS } from './constants';
import { describeByteSize } from './misc';

export type RunnerItemStatus = 'pending' | 'running' | 'completed' | 'failed' | 'canceled' | 'skipped';

export interface RunnerLiveItem {
  key: string;
  iteration: number;
  requestId: string;
  requestName: string;
  requestUrl: string;
  status: RunnerItemStatus;
  statusCode?: number;
  statusMessage?: string;
  responseTime?: number;
  responseSize?: number;
  errorMessage?: string;
  results?: RequestTestResult[];
}

export const buildRunnerItemKey = (iteration: number, index: number, requestId: string) =>
  `${iteration}-${index}-${requestId}`;

export const formatStatusLabel = (item: { statusCode?: number; statusMessage?: string }) => {
  if (item.statusCode && item.statusCode > 0) {
    const reason = item.statusMessage || RESPONSE_CODE_REASONS[item.statusCode] || '';
    return reason ? `${item.statusCode} ${reason}` : `${item.statusCode}`;
  }
  return item.statusMessage || '';
};

export const formatResponseStats = ({ responseTime, responseSize }: { responseTime?: number; responseSize?: number }) =>
  [
    typeof responseTime === 'number' && responseTime >= 0 ? `${Math.round(responseTime)}ms` : null,
    typeof responseSize === 'number' && responseSize >= 0 ? describeByteSize(responseSize, true) : null,
  ]
    .filter(Boolean)
    .join(' - ');

const STATUS_TAGS: Partial<Record<RunnerItemStatus, { label: string; className: string }>> = {
  pending: { label: 'PENDING', className: 'bg-slate-600' },
  running: { label: 'RUNNING', className: 'bg-sky-600' },
  canceled: { label: 'CANCELED', className: 'bg-slate-600' },
  skipped: { label: 'SKIPPED', className: 'bg-slate-600' },
};

export const getRunnerStatusTag = (item: { status: RunnerItemStatus; statusCode?: number; statusMessage?: string }) => {
  const fixed = STATUS_TAGS[item.status];
  if (fixed) {
    return fixed;
  }
  const label = formatStatusLabel(item);
  if (!label) {
    return { label: 'ERROR', className: 'bg-red-600' };
  }
  const code = item.statusCode ?? 0;
  const className =
    code >= 200 && code < 300 ? 'bg-lime-600' : code >= 300 && code < 400 ? 'bg-yellow-600' : 'bg-red-600';
  return { label, className };
};

export const isFinished = (status: RunnerItemStatus) =>
  status === 'completed' || status === 'failed' || status === 'canceled' || status === 'skipped';

import { isFinished, type RunnerLiveItem } from '~/common/runner-feedback';
import { cancelRequestById } from '~/network/cancellation.renderer';

interface ExecutionInfo {
  activeRequestId?: string;
  activeRequestKey?: string;
  error?: string;
  canceled?: boolean;
  skippedKeys?: string[];
  liveItems?: RunnerLiveItem[];
}

const runnerExecutions = new Map<string, ExecutionInfo>();

export function startExecution(workspaceId: string) {
  runnerExecutions.set(workspaceId, { canceled: false, skippedKeys: [], liveItems: [] });
}

export function updateExecution(workspaceId: string, executionInfo: ExecutionInfo) {
  const info = runnerExecutions.get(workspaceId);
  runnerExecutions.set(workspaceId, {
    ...info,
    ...executionInfo,
  });
}

export function getExecution(workspaceId: string) {
  return runnerExecutions.get(workspaceId) || {};
}

export function getRunnerLiveItems(workspaceId: string) {
  return runnerExecutions.get(workspaceId)?.liveItems || [];
}

export function upsertLiveItem(workspaceId: string, key: string, patch: Partial<RunnerLiveItem>) {
  const info = runnerExecutions.get(workspaceId);
  if (!info) {
    return;
  }
  const items = info.liveItems ? [...info.liveItems] : [];
  const idx = items.findIndex(item => item.key === key);
  if (idx === -1) {
    return;
  }
  const current = items[idx];
  const status = patch.status && !isFinished(current.status) ? patch.status : current.status;
  items[idx] = { ...current, ...patch, status };
  updateExecution(workspaceId, { liveItems: items });
}

export function isExecutionCanceled(workspaceId: string) {
  return Boolean(runnerExecutions.get(workspaceId)?.canceled);
}

export function isItemSkipped(workspaceId: string, key: string) {
  return Boolean(runnerExecutions.get(workspaceId)?.skippedKeys?.includes(key));
}

export function skipRunnerItem(workspaceId: string, key: string) {
  const info = runnerExecutions.get(workspaceId);
  if (!info) {
    return;
  }
  const skippedKeys = info.skippedKeys ? [...info.skippedKeys] : [];
  if (!skippedKeys.includes(key)) {
    skippedKeys.push(key);
  }
  updateExecution(workspaceId, { skippedKeys });
  if (info.activeRequestKey === key && info.activeRequestId) {
    cancelRequestById(info.activeRequestId);
  }
  upsertLiveItem(workspaceId, key, { status: 'skipped' });
}

function endExecution(workspaceId: string, forceComplete: boolean) {
  const { activeRequestId } = getExecution(workspaceId);
  if (activeRequestId) {
    cancelRequestById(activeRequestId);
    window.main.completeExecutionStep({ requestId: activeRequestId });
  }
  if (forceComplete || activeRequestId) {
    window.main.updateLatestStepName({ requestId: workspaceId, stepName: 'Done' });
    window.main.completeExecutionStep({ requestId: workspaceId });
  }
}

export function cancelExecution(workspaceId: string) {
  updateExecution(workspaceId, {
    canceled: true,
    liveItems: getRunnerLiveItems(workspaceId).map(item =>
      isFinished(item.status) ? item : { ...item, status: 'canceled' },
    ),
  });
  endExecution(workspaceId, true);
}

export function finishExecution(workspaceId: string) {
  endExecution(workspaceId, false);
}

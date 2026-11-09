import classnames from 'classnames';
import type { KonnectProject, WorkspaceChildrenForScope } from 'insomnia-data';
import { type ReactNode, useMemo, useState } from 'react';
import { Button, ListBox, ListBoxItem, Popover, Select, SelectValue } from 'react-aria-components';

import type { DebugSessionApiContext, DebugTraceSummary } from '~/konnect/debug-session-api';
import {
  buildSpanTree,
  flattenVisible,
  getRouteIdsFromTraceDetail,
  getTracePath,
  type SpanNode,
  summarizeTrace,
  type TraceSummaryBreakdown,
} from '~/konnect/debug-trace-helper';
import {
  findRouteRequestForTrace,
  type KonnectRouteRequest,
  listKonnectRouteRequests,
} from '~/konnect/route-request-lookup';
import { KonnectSettingsModal } from '~/ui/components/modals/konnect-settings-modal';
import { SizeTag } from '~/ui/components/tags/size-tag';
import { StatusTag } from '~/ui/components/tags/status-tag';
import { TimeTag } from '~/ui/components/tags/time-tag';
import { useTabNavigate } from '~/ui/hooks/use-insomnia-tab';
import { useKonnectDebuggerSession, useKonnectDebuggerSessionTrace } from '~/ui/hooks/use-konnect-debugger-session';
import { useOrganizationData } from '~/ui/hooks/use-organization-data';
import { useMultipleWorkspacesData } from '~/ui/hooks/use-workspace-data';
import { useKonnectSyncEnabled } from '~/ui/organization-utils';
import { METHOD_PILL_CLASSES } from '~/ui/utils/method-colors';

import { CopyButton } from '../base/copy-button';
import { Icon } from '../icon';
import { Tooltip } from '../tooltip';

const captureDurations: { id: number; name: string }[] = [
  { id: 15, name: '15 seconds' },
  { id: 30, name: '30 seconds' },
  { id: 60, name: '1 minute' },
  { id: 300, name: '5 minutes' },
  { id: 600, name: '10 minutes' },
  { id: 1200, name: '20 minutes' },
  { id: 1800, name: '30 minutes' },
];

type SummaryPart = 'kong' | 'upstream' | 'client' | 'third_party';

const PART_BG: Record<SummaryPart, string> = {
  kong: 'bg-lime-400',
  upstream: 'bg-sky-400',
  client: 'bg-zinc-500',
  third_party: 'bg-amber-400',
};

const PART_LABEL: Record<SummaryPart, string> = {
  kong: 'Kong (internal)',
  upstream: 'Upstream',
  client: 'Client',
  third_party: '3rd-party',
};

const formatMs = (ms: number) =>
  ms < 1 ? `${ms.toFixed(2)}ms` : ms < 100 ? `${ms.toFixed(1)}ms` : `${ms.toFixed(0)}ms`;

// The summary shows fixed two-decimal values, e.g. 1.23ms (1.69%).
const formatSummaryMs = (ms: number) => `${ms.toFixed(2)}ms`;

const ordinal = (n: number) => {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${n}th`;
  }
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'}`;
};

// e.g. "Oct 15th, 2026, 12:04:58 PM (3 min ago)"
const formatStartedAt = (startedAt: string | null) => {
  const startMs = startedAt ? Date.parse(startedAt) : Number.NaN;
  if (Number.isNaN(startMs)) {
    return null;
  }
  const date = new Date(startMs);
  const month = date.toLocaleString('en-US', { month: 'short' });
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const mins = Math.floor(Math.max(0, Date.now() - startMs) / 60_000);
  const hours = Math.floor(mins / 60);
  const ago = mins < 1 ? 'Just now' : mins < 60 ? `${mins} min ago` : `${hours} hour${hours === 1 ? '' : 's'} ago`;
  return `${month} ${ordinal(date.getDate())}, ${date.getFullYear()}, ${time} (${ago})`;
};

export const KonnectDebuggerPane = ({ project: currentProject }: { project: KonnectProject }) => {
  const {
    _id: projectId,
    konnectRegion,
    konnectControlPlaneId,
    konnectDebugSessionId,
    parentId: organizationId,
  } = currentProject;
  const { workspaces } = useOrganizationData(organizationId);

  const [durationSecs, setDurationSecs] = useState(15);
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const konnectDebuggerSession = useKonnectDebuggerSession({
    projectId,
    konnectRegion: konnectRegion!,
    konnectControlPlaneId: konnectControlPlaneId || '',
    konnectDebugSessionId: konnectDebugSessionId || '',
  });
  const {
    debugSession,
    debugSessionState,
    traces: originTraces,
    traceDetails,
    debugSessionAction,
    capturedSecs,
    ctx: debugSessionContext,
    startDebugSession,
    stopDebugSession,
    sessionId: debuggerSessionId,
    isLoading: isLoadingDebugSession,
  } = konnectDebuggerSession;
  const isStartingOrStopping = debugSessionAction !== 'idle';
  const isActive = debugSessionState === 'active';
  const isCompleting = debugSessionState === 'completing' || debugSessionState === 'timed_out';
  const isCapturing = isActive || isCompleting;

  const traces = useMemo(
    () => [...originTraces].sort((a, b) => Number(BigInt(b.startTimeUnixNano) - BigInt(a.startTimeUnixNano))),
    [originTraces],
  );
  const existingSelectedTraceId =
    selectedTraceId && traces.some(trace => trace.traceId === selectedTraceId) ? selectedTraceId : null;
  const selectedTrace = traces.find(trace => trace.traceId === existingSelectedTraceId) ?? null;

  const projectCollections = useMemo(
    () => workspaces.filter(w => w.parentId === projectId && (w.scope === 'collection' || w.scope === 'design')),
    [workspaces, projectId],
  );
  const projectWorkspaceIds = useMemo(() => projectCollections.map(w => w._id), [projectCollections]);
  const { dataByWorkspaceId: collectionByWorkspaceIds } = useMultipleWorkspacesData(projectWorkspaceIds);
  const routeRequests = useMemo(
    () =>
      listKonnectRouteRequests(
        projectCollections,
        collectionByWorkspaceIds as Map<string, WorkspaceChildrenForScope<'collection' | 'design'>>,
      ),
    [projectCollections, collectionByWorkspaceIds],
  );
  const routeRequestByTraceId = useMemo(() => {
    const result = new Map<string, KonnectRouteRequest>();
    for (const trace of traces) {
      const detail = traceDetails.get(trace.traceId);
      const routeRequest =
        detail && findRouteRequestForTrace(routeRequests, getRouteIdsFromTraceDetail(detail), trace.method);
      if (routeRequest) {
        result.set(trace.traceId, routeRequest);
      }
    }
    return result;
  }, [traces, traceDetails, routeRequests]);
  const tabNavigate = useTabNavigate();
  const openRequest = ({ request, workspaceId, workspaceName }: KonnectRouteRequest) =>
    tabNavigate(
      {
        organization: organizationId,
        project: currentProject,
        workspace: { _id: workspaceId, name: workspaceName },
        item: request,
      },
      { withTab: true, shouldNavigate: true },
    );

  const hasSession = !!debugSession;
  const showEmptyState = !hasSession && !isStartingOrStopping;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden text-sm">
      <MetadataPane
        projectName={currentProject.name}
        controlPlaneId={typeof konnectControlPlaneId === 'string' ? konnectControlPlaneId : null}
        region={typeof konnectRegion === 'string' ? konnectRegion : null}
        debugSessionId={debuggerSessionId}
      />
      <StatusBanners debug={konnectDebuggerSession} />
      <div className="flex shrink-0 flex-row flex-wrap items-center gap-3 border-b border-solid border-(--hl-md) px-3 py-2">
        {!isCapturing && (
          <>
            <span className="text-(--hl)">Duration</span>
            <Select
              aria-label="Debug session duration"
              value={durationSecs}
              onChange={key => key !== null && setDurationSecs(Number(key))}
            >
              <Button className="flex min-w-[12ch] items-center justify-between gap-2 rounded-xs border border-solid border-(--hl-md) px-3 py-1 text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset disabled:opacity-50">
                <SelectValue<{ id: number; name: string }> className="truncate">
                  {({ selectedText }) => <span>{selectedText}</span>}
                </SelectValue>
                <Icon icon="caret-down" />
              </Button>
              <Popover className="flex min-w-max flex-col overflow-y-hidden">
                <ListBox
                  items={captureDurations}
                  className="min-w-max overflow-y-auto rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) py-2 text-sm shadow-lg select-none focus:outline-hidden"
                >
                  {item => (
                    <ListBoxItem
                      className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden aria-selected:font-bold"
                      aria-label={item.name}
                      textValue={item.name}
                    >
                      {({ isSelected }) => (
                        <>
                          <span>{item.name}</span>
                          {isSelected && <Icon icon="check" className="justify-self-end text-(--color-success)" />}
                        </>
                      )}
                    </ListBoxItem>
                  )}
                </ListBox>
              </Popover>
            </Select>
            <Button
              // Disable the start button if a session is starting/stopping, konnect PAT is missing, or current debug session is loading.
              isDisabled={isStartingOrStopping || !debugSessionContext.pat || isLoadingDebugSession}
              onPress={() => startDebugSession(durationSecs)}
              className="rounded-xs bg-(--color-surprise) px-3 py-1 font-semibold text-(--color-font-surprise) transition-all hover:brightness-90 focus:brightness-90 disabled:opacity-50"
            >
              {hasSession ? 'Restart' : 'Start debugging'}
            </Button>
          </>
        )}

        {isCapturing && (
          <>
            <span className="text-(--hl)" aria-live="polite">
              {hasSession && isActive && `Capturing... ${capturedSecs}s/${debugSession.durationSecs}s`}
              {hasSession && isCompleting && 'Wrapping up  —— waiting for Konnect to finish the session'}
            </span>
            <Button
              isDisabled={isStartingOrStopping}
              onPress={() => stopDebugSession()}
              className="rounded-xs border border-solid border-(--hl-md) px-3 py-1 text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset disabled:opacity-50"
            >
              Stop
            </Button>
          </>
        )}

        <Button
          // FIXME Update the link for debugger integration when it's ready
          onClick={() => window.main.openInBrowser('https://insomnia.rest/breaking-changes')}
          className="ml-auto cursor-pointer border-0 bg-transparent p-0 text-(--hl) underline"
        >
          Learn more
        </Button>
      </div>

      {showEmptyState ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-(--hl)">
          {isLoadingDebugSession
            ? 'Loading data for existing debugger session…'
            : 'Start a debugger session to observe live traffic on this control plane.'}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <TraceList
            traces={traces}
            routeRequestByTraceId={routeRequestByTraceId}
            onOpenRequest={openRequest}
            selectedId={existingSelectedTraceId}
            onSelect={setSelectedTraceId}
            isActive={isActive}
          />
          <div className="min-w-0 flex-1 overflow-y-auto">
            {selectedTrace ? (
              <TraceDetail
                key={selectedTrace.traceId}
                trace={selectedTrace}
                ctx={debugSessionContext}
                sessionId={debuggerSessionId!}
              />
            ) : (
              <div className="p-6 text-center text-(--hl)">
                {isActive && traces.length === 0 && (
                  <>
                    <div>Waiting for the first request...</div>
                    <div>
                      Send any request against this control plane now —— results may take a few seconds to appear.
                    </div>
                  </>
                )}
                {traces.length > 0 && 'Select a trace from the list to view its details.'}
                {!isActive && traces.length === 0 && 'No traces captured.'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const RetryButton = ({ onPress }: { onPress: () => void }) => (
  <Button
    onPress={onPress}
    className="rounded-xs border border-solid border-current px-2 py-0.5 ring-1 ring-transparent focus:ring-(--hl-md)"
  >
    Retry
  </Button>
);

const StatusBanner = ({
  type,
  children,
  action,
}: {
  type: 'info' | 'warning' | 'error';
  children: ReactNode;
  action?: ReactNode;
}) => (
  <div
    role={type === 'error' ? 'alert' : 'status'}
    className={classnames(
      'flex shrink-0 items-center gap-2 border-b border-solid border-(--hl-md) px-3 py-1.5',
      type === 'error' && 'text-(--color-danger)',
      type === 'warning' && 'text-(--color-warning)',
      type === 'info' && 'text-(--hl)',
    )}
  >
    <Icon icon={type === 'info' ? 'circle-info' : 'triangle-exclamation'} />
    <span className="flex-1">{children}</span>
    {action}
  </div>
);

const StatusBanners = ({ debug }: { debug: ReturnType<typeof useKonnectDebuggerSession> }) => {
  const { debugSession, debugSessionState, hasKonnectPat, authError, retryDebugSession, mutationError } = debug;
  const startedAtText = formatStartedAt(debugSession?.startedAt ?? null);
  const [isKonnectSettingsModalOpen, setIsKonnectSettingsModalOpen] = useState(false);
  const konnectSyncEnabled = useKonnectSyncEnabled();

  return (
    <>
      {!hasKonnectPat && (
        <StatusBanner type="error">
          No Konnect token found. Connect one from the Konnect sync bar in the sidebar.
        </StatusBanner>
      )}
      {debugSessionState === 'active' && (
        <StatusBanner type="info">
          {startedAtText ? (
            <>
              Session started <strong>{startedAtText}</strong>
            </>
          ) : (
            'Debugger session is in progress'
          )}
        </StatusBanner>
      )}
      {authError && (
        <StatusBanner
          type="error"
          action={
            <Button
              onPress={() => setIsKonnectSettingsModalOpen(true)}
              className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-white/40 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10 aria-pressed:bg-white/10"
            >
              Configure
            </Button>
          }
        >
          <p>{authError.message}</p>
        </StatusBanner>
      )}
      {mutationError && (
        <StatusBanner type="error" action={<RetryButton onPress={retryDebugSession} />}>
          {mutationError.message}
        </StatusBanner>
      )}
      {debug.sessionDeleted && (
        <StatusBanner type="warning">Current debug session was deleted in Konnect.</StatusBanner>
      )}
      {debugSessionState === 'completing' && <StatusBanner type="info">Wait for the session to complete.</StatusBanner>}
      {debugSessionState === 'cancelled' && <StatusBanner type="info">Session cancelled.</StatusBanner>}
      {debugSessionState === 'completed' && <StatusBanner type="info">Session completed.</StatusBanner>}
      {isKonnectSettingsModalOpen && (
        <KonnectSettingsModal
          onClose={() => setIsKonnectSettingsModalOpen(false)}
          konnectSyncEnabled={konnectSyncEnabled}
          onlyUpdateKonnectPat
        />
      )}
    </>
  );
};

const TraceList = ({
  traces,
  routeRequestByTraceId,
  onOpenRequest,
  selectedId,
  onSelect,
  isActive,
}: {
  traces: DebugTraceSummary[];
  routeRequestByTraceId: ReadonlyMap<string, KonnectRouteRequest>;
  onOpenRequest: (routeRequest: KonnectRouteRequest) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  isActive: boolean;
}) => (
  <div className="flex w-56 shrink-0 flex-col overflow-y-auto border-r border-solid border-(--hl-md)">
    <div className="border-b border-solid border-(--hl-md) px-3 py-2 text-xs">
      <div className="font-bold tracking-wide text-(--hl) uppercase">Captured ({traces.length})</div>
      <div className="text-(--hl)">Whole control plane and results may take a few seconds to appear.</div>
    </div>
    {traces.length === 0 && isActive && <div className="px-3 py-2 text-xs text-(--hl)">Listening for traffic…</div>}
    {traces.map(trace => {
      const routeRequest = routeRequestByTraceId.get(trace.traceId);
      const isSelected = trace.traceId === selectedId;
      const upperTraceMethod = (trace.method || '').toUpperCase();
      return (
        <div
          key={trace.traceId}
          className={classnames(
            'group relative flex border-b border-solid border-(--hl-md) ring-1 ring-transparent transition-colors focus-within:ring-(--hl-md) focus-within:ring-inset',
            isSelected ? 'bg-(--hl-sm)' : 'hover:bg-(--hl-xs)',
            'border-l-transparent',
          )}
        >
          <Button
            onPress={() => onSelect(trace.traceId)}
            aria-label={`Trace ${trace.traceId}`}
            className="flex min-w-0 flex-1 flex-col items-start gap-1 px-3 py-2.5 text-left whitespace-normal outline-hidden"
          >
            <Tooltip message={trace.traceId} position="right" selectable>
              <span className="pr-6 font-mono text-xs">{trace.traceId.slice(0, 12)}…</span>
            </Tooltip>
            <div className="flex w-full min-w-0 items-start gap-2 text-xs">
              <span
                className={`flex w-10 shrink-0 items-center justify-center rounded-xs border border-solid border-(--hl-sm) text-[0.65rem] ${METHOD_PILL_CLASSES[upperTraceMethod] || 'bg-(--hl-md) text-(--color-font)'}`}
              >
                {upperTraceMethod}
              </span>
              <div className="min-w-0 break-all">{getTracePath(trace) ?? ''}</div>
            </div>
            <span className="text-xs text-(--hl)">{formatMs(trace.durationMs)}</span>
          </Button>
          {routeRequest && (
            <Button
              onPress={() => onOpenRequest(routeRequest)}
              aria-label={`Open request ${routeRequest.request.name}`}
              className="absolute right-2.5 bottom-2.5 flex max-w-[45%] items-center gap-1 truncate text-xs text-(--color-surprise) underline ring-1 ring-transparent outline-hidden focus:ring-(--hl-md)"
            >
              <span className="truncate">{routeRequest.request.name}</span>
            </Button>
          )}
          <CopyButton
            size="small"
            content={trace.traceId}
            title="Copy trace ID"
            confirmMessage=""
            className="absolute top-3 right-2.5 h-5! border-0! bg-transparent! px-1.5! opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          >
            <i className="fa fa-copy" />
          </CopyButton>
        </div>
      );
    })}
  </div>
);

const MetadataPane = ({
  projectName,
  controlPlaneId,
  region,
  debugSessionId,
}: {
  projectName: string;
  controlPlaneId: string | null;
  region: string | null;
  debugSessionId: string | null;
}) => {
  const items: { label: string; value?: string | null; allowCopy?: boolean; copyValue?: string | null }[] = [
    { label: 'Control Plane', value: projectName, copyValue: controlPlaneId, allowCopy: true },
    { label: 'Region', value: region?.toLocaleUpperCase() },
    { label: 'Session ID', value: debugSessionId, allowCopy: true },
  ].filter(item => !!item.value);

  return (
    <dl
      aria-label="Debug session metadata"
      className="m-0 flex shrink-0 flex-row flex-wrap gap-x-6 gap-y-1 border-b border-solid border-(--hl-md) px-3 py-2 text-xs"
    >
      {items.map(({ label, value, allowCopy = false, copyValue }) => (
        <div key={label} className="flex items-center gap-2">
          <dt className="text-(--hl)">{label}</dt>
          <dd className="m-0 font-mono">{value}</dd>
          {allowCopy && (
            <CopyButton
              size="small"
              content={copyValue ?? value!}
              title={`Copy ${label.toLowerCase()}`}
              confirmMessage=""
              className="h-5! border-0! bg-transparent! px-1.5!"
            >
              <i className="fa fa-copy" />
            </CopyButton>
          )}
        </div>
      ))}
    </dl>
  );
};

const summaryParts = (summary: TraceSummaryBreakdown) =>
  [
    { part: 'kong', ms: summary.kongMs, pct: summary.kongPct },
    { part: 'upstream', ms: summary.upstreamMs, pct: summary.upstreamPct },
    { part: 'client', ms: summary.clientMs, pct: summary.clientPct },
    { part: 'third_party', ms: summary.thirdPartyMs, pct: summary.thirdPartyPct },
  ] as const;

const TraceDetail = ({
  trace,
  ctx,
  sessionId,
}: {
  trace: DebugTraceSummary;
  ctx: DebugSessionApiContext;
  sessionId: string;
}) => {
  const { detail, errorKind, refetch: onRetry } = useKonnectDebuggerSessionTrace(ctx, sessionId, trace.traceId);
  const tree = useMemo(() => (detail ? buildSpanTree(detail) : null), [detail]);
  const summary = useMemo(() => (tree ? summarizeTrace(tree) : null), [tree]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  const [expandedAttrs, setExpandedAttrs] = useState<ReadonlySet<string>>(new Set());

  const toggle = (set: ReadonlySet<string>, id: string) => {
    const next = new Set(set);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  };

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex items-stretch gap-2 font-mono">
        {trace.statusCode !== null && <StatusTag statusCode={trace.statusCode} />}
        <TimeTag milliseconds={summary?.totalMs ?? tree?.totalMs ?? trace.durationMs} />
        <SizeTag bytesRead={summary?.responseSize || 0} bytesContent={0} showTooltip={false} />
      </div>

      {errorKind ? (
        <div className="flex items-center gap-2 text-(--color-warning)">
          <Icon icon="triangle-exclamation" />
          <span className="flex-1">
            {errorKind === 'not_found' ? 'This trace is no longer available.' : 'Could not load this trace.'}
          </span>
          {errorKind !== 'not_found' && <RetryButton onPress={onRetry} />}
        </div>
      ) : !tree ? (
        <div className="text-(--hl)">Loading trace…</div>
      ) : tree.roots.length === 0 ? (
        <div className="text-(--hl)">This trace has no spans.</div>
      ) : (
        <>
          {summary && (
            <>
              <div
                className="flex h-2 w-full overflow-hidden rounded-full bg-(--hl-sm)"
                role="img"
                aria-label="Time split"
              >
                {summaryParts(summary).map(({ part, pct }) => (
                  <div key={part} className={PART_BG[part]} style={{ width: `${pct}%` }} />
                ))}
              </div>
              <div className="flex flex-col gap-1 text-sm">
                {summaryParts(summary).map(({ part, ms, pct }) => (
                  <div key={part} className="flex items-center gap-2">
                    <span className={classnames('inline-block h-2 w-2 rounded-xs', PART_BG[part])} />
                    <span className="text-(--hl)">{PART_LABEL[part]}</span>
                    <span className="font-bold">{formatSummaryMs(ms)}</span>
                    <span className="text-xs text-(--hl)">({pct.toFixed(2)}%)</span>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="mt-2 flex flex-col">
            {flattenVisible(tree.roots, collapsed).map(node => (
              <SpanRow
                key={node.span.spanId}
                node={node}
                totalMs={tree.totalMs}
                isCollapsed={collapsed.has(node.span.spanId)}
                isAttrsOpen={expandedAttrs.has(node.span.spanId)}
                onToggleChildren={() => setCollapsed(current => toggle(current, node.span.spanId))}
                onToggleAttrs={() => setExpandedAttrs(current => toggle(current, node.span.spanId))}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const SpanRow = ({
  node,
  totalMs,
  isCollapsed,
  isAttrsOpen,
  onToggleChildren,
  onToggleAttrs,
}: {
  node: SpanNode;
  totalMs: number;
  isCollapsed: boolean;
  isAttrsOpen: boolean;
  onToggleChildren: () => void;
  onToggleAttrs: () => void;
}) => {
  const attributes = Object.entries(node.span.attributes);
  const left = totalMs > 0 ? (node.startOffsetMs / totalMs) * 100 : 0;
  const width = totalMs > 0 ? Math.max((node.durationMs / totalMs) * 100, 0.4) : 0;
  return (
    <div>
      <div className="flex h-7 items-center gap-2 hover:bg-(--hl-xs)">
        <div className="flex w-56 shrink-0 items-center truncate" style={{ paddingLeft: `${node.depth * 12}px` }}>
          {node.children.length > 0 ? (
            <Button
              aria-label={isCollapsed ? `Expand ${node.name}` : `Collapse ${node.name}`}
              onPress={onToggleChildren}
              className="flex w-4 items-center justify-center text-(--hl)"
            >
              <Icon icon={isCollapsed ? 'caret-right' : 'caret-down'} />
            </Button>
          ) : (
            <span className="w-4" />
          )}
          <Button
            isDisabled={attributes.length === 0}
            onPress={onToggleAttrs}
            className="truncate text-left disabled:cursor-default"
            aria-expanded={isAttrsOpen}
          >
            {node.name}
          </Button>
        </div>
        <div className="relative h-2 min-w-0 flex-1 rounded-xs bg-(--hl-sm)">
          <div
            className={'absolute h-full rounded-xs bg-(--color-surprise)'}
            style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }}
          />
        </div>
        <span className="w-20 shrink-0 text-right font-mono text-xs">{formatMs(node.durationMs)}</span>
      </div>
      {isAttrsOpen && attributes.length > 0 && (
        <div
          className="my-1 ml-6 rounded-xs bg-(--hl-xs) p-2 font-mono text-xs"
          style={{ marginLeft: `${node.depth * 12 + 24}px` }}
        >
          {attributes.map(([key, value]) => (
            <div key={key} className="flex gap-3">
              <span className="text-(--hl)">{key}</span>
              <span className="break-all">{typeof value === 'string' ? value : JSON.stringify(value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

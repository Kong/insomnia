import { useMemo, useState } from 'react';

import type { SyncResult } from '~/konnect/sync';
import { useDevPortalSync } from '~/ui/hooks/use-dev-portal-sync';

import { Icon } from '../../icon';

export const DevPortalSyncResultToast = ({ onDismiss }: { onDismiss: () => void }) =>
  //   {
  //   devPortalSyncResult,
  //   onDismiss,
  //   progress,
  //   syncing,
  // }: {
  //   devPortalSyncResult: DevPortalSyncResult;
  //   onDismiss: () => void;
  //   progress: string;
  //   syncing: boolean;
  // }
  {
    const { isSyncing, progress, cancelSync, syncingResult } = useDevPortalSync();

    const [showSyncDetails, setShowSyncDetails] = useState(false);
    const [copiedReason, setCopiedReason] = useState<string | null>(null);
    const { success, skippedVersions, error, errorDetails, versions } = syncingResult!;
    const successWithoutWarnings = success && skippedVersions.length === 0;
    const canShowDetails = success && skippedVersions.length > 0;
    const getSyncResultTitle = () => {
      if (!success) {
        return 'Sync failed';
      } else if (successWithoutWarnings) {
        return 'Sync complete';
      }
      return 'Sync complete, with warnings';
    };
    const getSyncResultDescription = () => {
      if (!success) {
        return error || errorDetails?.message || 'An unknown error occurred during sync.';
      }
      const versionAddedCount = versions.created;
      const versionUpdatedCount = versions.updated;
      const versionSkippedCount = versions.skipped;
      return (
        [
          versionAddedCount > 0 && `${versionAddedCount} API Version(s) added`,
          versionUpdatedCount > 0 && `${versionUpdatedCount} API Version(s) updated`,
          versionSkippedCount > 0 && `${versionSkippedCount} API Version(s) skipped`,
        ]
          .filter(Boolean)
          .join(', ') + '.'
      );
    };

    if (isSyncing) {
      return (
        <div className="m-2 flex items-start justify-between gap-2 rounded-sm bg-[rgba(53,53,53,1)] p-3 text-xs">
          <div className="flex min-w-0 items-start gap-3">
            <Icon icon="spinner" className="mt-1.5 animate-spin" />
            <p className="mt-0.5 break-all text-(--hl)">{progress}</p>
          </div>
          <button className="-mt-2 shrink-0 text-xl text-(--hl) hover:text-(--color-font)" onClick={onDismiss}>
            <Icon icon="close" />
          </button>
        </div>
      );
    }

    return (
      <div
        className={`m-2 flex items-start justify-between gap-2 rounded-sm p-3 text-xs ${
          !success
            ? 'bg-[rgba(58,18,8,1)]'
            : !successWithoutWarnings
              ? 'bg-[rgba(250,173,20,0.15)]'
              : 'bg-[rgba(82,196,26,0.15)]'
        }`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <Icon
            icon={successWithoutWarnings ? 'circle-check' : 'exclamation-triangle'}
            className={successWithoutWarnings ? 'mt-1.5' : 'mt-1'}
          />
          <div className="min-w-0">
            <p className="font-semibold text-(--color-font)">{getSyncResultTitle()}</p>
            <p className="mt-0.5 wrap-break-word text-(--hl)">{getSyncResultDescription()}</p>
          </div>
        </div>
        <button className="-mt-2 shrink-0 text-xl text-(--hl) hover:text-(--color-font)" onClick={onDismiss}>
          <Icon icon="close" />
        </button>
      </div>
    );
  };

export const ControlPlanesSyncResultToast = ({
  lastSyncResult,
  onDismiss,
}: {
  lastSyncResult: SyncResult;
  onDismiss: () => void;
}) => {
  const [showSyncDetails, setShowSyncDetails] = useState(false);
  const [copiedReason, setCopiedReason] = useState<string | null>(null);

  const skippedRoutesByReason = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const { routeName, reason, serviceName } of lastSyncResult?.skippedRoutes ?? []) {
      const list = map.get(reason) ?? [];
      list.push(`${routeName} — ${serviceName}`);
      map.set(reason, list);
    }
    return map;
  }, [lastSyncResult]);

  return (
    <div
      className={`m-2 flex items-start justify-between gap-2 rounded-sm p-3 text-xs ${
        !lastSyncResult.success
          ? 'bg-[rgba(58,18,8,1)]'
          : lastSyncResult.skippedRoutes.length > 0 || lastSyncResult.skippedRegions.length > 0
            ? 'bg-[rgba(250,173,20,0.15)]'
            : 'bg-[rgba(82,196,26,0.15)]'
      }`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon
          icon={
            lastSyncResult.success &&
            lastSyncResult.skippedRoutes.length === 0 &&
            lastSyncResult.skippedRegions.length === 0
              ? 'circle-check'
              : 'exclamation-triangle'
          }
          className={
            lastSyncResult.success &&
            lastSyncResult.skippedRoutes.length === 0 &&
            lastSyncResult.skippedRegions.length === 0
              ? 'mt-1.5'
              : 'mt-1'
          }
        />
        <div className="min-w-0">
          <p className="font-semibold text-(--color-font)">
            {lastSyncResult.success
              ? lastSyncResult.skippedRoutes.length > 0 || lastSyncResult.skippedRegions.length > 0
                ? 'Sync complete, with warnings'
                : 'Sync complete'
              : 'Sync failed'}
          </p>
          <p className="mt-0.5 text-(--hl)">
            {!lastSyncResult.success
              ? lastSyncResult.error
              : lastSyncResult.routes.created === 0 &&
                  lastSyncResult.routes.updated === 0 &&
                  lastSyncResult.routes.deleted === 0 &&
                  lastSyncResult.routes.skipped === 0 &&
                  lastSyncResult.skippedRegions.length === 0
                ? 'Already up-to-date with Konnect.'
                : [
                    lastSyncResult.routes.created > 0 && `${lastSyncResult.routes.created} request(s) added`,
                    lastSyncResult.routes.updated > 0 && `${lastSyncResult.routes.updated} request(s) updated`,
                    lastSyncResult.routes.deleted > 0 && `${lastSyncResult.routes.deleted} request(s) deleted`,
                    lastSyncResult.routes.skipped > 0 && `${lastSyncResult.routes.skipped} route(s) skipped`,
                    lastSyncResult.skippedRegions.length > 0 &&
                      `${lastSyncResult.skippedRegions.length} region(s) skipped`,
                  ]
                    .filter(Boolean)
                    .join(', ') + '.'}
          </p>
          {lastSyncResult.success &&
            (lastSyncResult.skippedRoutes.length > 0 || lastSyncResult.skippedRegions.length > 0) && (
              <>
                <button
                  className="mt-1 flex items-center gap-1 text-(--hl) hover:text-(--color-font)"
                  onClick={() => setShowSyncDetails(prev => !prev)}
                >
                  <Icon icon={showSyncDetails ? 'chevron-down' : 'chevron-right'} className="h-2.5 w-2.5" />
                  {showSyncDetails ? 'Hide details' : 'Show details'}
                </button>
                {showSyncDetails && (
                  <div className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                    {lastSyncResult.skippedRegions.length > 0 && (
                      <div>
                        <p className="text-(--hl)">Failed to fetch control planes for the following regions:</p>
                        <ul className="mt-1 space-y-0.5 pl-3">
                          {lastSyncResult.skippedRegions.map(r => (
                            <li key={r} className="list-disc text-(--color-font)">
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {[...skippedRoutesByReason.entries()].map(([reason, routes]) => {
                      const MAX_SHOW = 5;
                      const visible = routes.slice(0, MAX_SHOW);
                      const extra = routes.length - MAX_SHOW;
                      return (
                        <div key={reason}>
                          <p className="text-(--hl)">{reason} for the following routes:</p>
                          <ul className="mt-1 space-y-0.5 pl-3">
                            {visible.map(r => (
                              <li key={r} className="list-disc text-(--color-font)">
                                {r}
                              </li>
                            ))}
                          </ul>
                          {extra > 0 && (
                            <div className="mt-1 flex items-center gap-2 pl-3 text-(--hl)">
                              <span>+ {extra} more</span>
                              <button
                                className="underline hover:text-(--color-font)"
                                onClick={() => {
                                  navigator.clipboard.writeText(routes.join('\n'));
                                  setCopiedReason(reason);
                                  setTimeout(() => setCopiedReason(null), 2000);
                                }}
                              >
                                {copiedReason === reason ? 'Copied' : 'Copy full list'}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
        </div>
      </div>
      <button className="-mt-2 shrink-0 text-xl text-(--hl) hover:text-(--color-font)" onClick={onDismiss}>
        <Icon icon="close" />
      </button>
    </div>
  );
};

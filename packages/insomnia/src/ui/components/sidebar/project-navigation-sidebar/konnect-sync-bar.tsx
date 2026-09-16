import { models, services } from 'insomnia-data';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';
import { useNavigate } from 'react-router';
import * as reactUse from 'react-use';

import type { SyncResult } from '~/konnect/sync';
import { useRootLoaderData } from '~/root';
import { KongLogo } from '~/ui/components/kong-logo';
import { showModal } from '~/ui/components/modals';
import { AskModal } from '~/ui/components/modals/ask-modal';
import { KonnectSettingsModal } from '~/ui/components/modals/konnect-settings-modal';
import uiEventBus, { KONNECT_SYNC_TRIGGER } from '~/ui/event-bus';
import { useKonnectSync } from '~/ui/hooks/use-konnect-sync';
import insomniaLogo from '~/ui/images/insomnia-logo.svg';
import { refreshKonnectAccess, useKonnectSyncEnabled } from '~/ui/organization-utils';

import { Icon } from '../../icon';

function getRelativeTimeString(timestamp: number, now: number = Date.now()): string {
  const seconds = Math.floor((now - timestamp) / 1000);
  if (seconds < 60) {
    return `${seconds}s ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes}m ${seconds % 60}s ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ${minutes % 60}m ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h ago`;
}

function LastSyncedLabel({ lastSyncedAt }: { lastSyncedAt: number | null }) {
  return lastSyncedAt ? `Last synced: ${getRelativeTimeString(lastSyncedAt, Date.now())}` : 'Not yet synced';
}

interface UseKonnectSyncBarOptions {
  organizationId: string;
  /** Whether the Konnect organization currently has any (synced) projects. */
  hasProjects: boolean;
  /** Only meaningful when a sidebar tree is rendered alongside the bar — there is nothing to
   * anchor the one-time environment-variable onboarding tooltip to otherwise. */
  onFirstSyncEnvWorkspace?: (workspaceId: string) => void;
  /** Only meaningful when a sidebar tree is rendered alongside the bar — there is nothing to
   * expand when the sidebar has no tree yet. Owned by the caller since the full sidebar already
   * keeps this in its own `useLocalStorage` state. */
  setExpandedProjectAndWorkspaceIds?: (updater: (prev: string[] | undefined) => string[]) => void;
}

/**
 * Owns all Konnect sync state (button/progress/last-result/settings modal) so it can be rendered
 * both from the full sidebar (a project is selected) and the empty-state sidebar (zero projects) —
 * the two are mutually exclusive routes, so only one KONNECT_SYNC_TRIGGER subscriber is ever mounted
 * at a time.
 */
export function useKonnectSyncBar({
  organizationId,
  hasProjects,
  onFirstSyncEnvWorkspace,
  setExpandedProjectAndWorkspaceIds,
}: UseKonnectSyncBarOptions) {
  const navigate = useNavigate();
  const { settings, userSession } = useRootLoaderData()!;
  const konnectSyncEnabled = useKonnectSyncEnabled();
  const { syncing, progress, startSync, cancelSync } = useKonnectSync();
  const [lastSyncedAt, setLastSyncedAt] = reactUse.useLocalStorage<number | null>(
    `${organizationId}:konnect-last-synced-at`,
    null,
  );
  const [lastSyncResult, setLastSyncResult] = useState<SyncResult | null>(null);
  const [showSyncDetails, setShowSyncDetails] = useState(false);
  const [copiedReason, setCopiedReason] = useState<string | null>(null);
  const [showKonnectConfigModal, setShowKonnectConfigModal] = useState(false);

  const skippedRoutesByReason = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const { routeName, reason, serviceName } of lastSyncResult?.skippedRoutes ?? []) {
      const list = map.get(reason) ?? [];
      list.push(`${routeName} — ${serviceName}`);
      map.set(reason, list);
    }
    return map;
  }, [lastSyncResult]);

  const syncKonnectProjectsAndNotify = useCallback(async (konnectOrganizationId?: string | null) => {
    setLastSyncResult(null);
    const isFirstSync = lastSyncedAt == null;
    const result = await startSync(
      organizationId,
      konnectOrganizationId !== undefined ? konnectOrganizationId : settings.konnectOrganizationId,
    );
    setLastSyncResult(result ?? null);
    setShowSyncDetails(false);
    setCopiedReason(null);
    if (result?.success) {
      setLastSyncedAt(Date.now());
      // Navigate to and expand the first Konnect project after a successful sync
      const allProjects = await services.project.listByOrganizationIds(organizationId);
      const sortedKonnectProjects = models.project.sortProjects(
        allProjects.filter(p => p.konnectControlPlaneId != null),
      );
      const firstKonnectProject = sortedKonnectProjects[0];
      if (firstKonnectProject) {
        const workspaces = await services.workspace.listByParentId(firstKonnectProject._id);
        const envWorkspace = workspaces.find(w => w.scope === 'environment');
        if (envWorkspace) {
          // Show environment onboarding after first successful sync
          if (isFirstSync) {
            onFirstSyncEnvWorkspace?.(envWorkspace._id);
          }
          navigate(
            `/organization/${organizationId}/project/${firstKonnectProject._id}/workspace/${envWorkspace._id}/environment`,
          );
        } else {
          navigate(`/organization/${organizationId}/project/${firstKonnectProject._id}`);
        }
        setExpandedProjectAndWorkspaceIds?.(prev => {
          const ids = prev || [];
          return ids.includes(firstKonnectProject._id) ? ids : [...ids, firstKonnectProject._id];
        });
      }
    }
  }, [
    lastSyncedAt,
    startSync,
    organizationId,
    settings.konnectOrganizationId,
    navigate,
    onFirstSyncEnvWorkspace,
    setExpandedProjectAndWorkspaceIds,
    setLastSyncedAt,
  ]);
  useEffect(() => {
    return uiEventBus.on(KONNECT_SYNC_TRIGGER, syncKonnectProjectsAndNotify);
  }, [syncKonnectProjectsAndNotify]);

  const handleSync = async () => {
    if (!konnectSyncEnabled) {
      return;
    }

    if (hasProjects) {
      showModal(AskModal, {
        title: 'Sync updates from Konnect',
        message: (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <KongLogo width={20} height={20} />
                <span className="text-sm font-medium">Konnect</span>
              </div>
              <span className="text-(--hl)">→</span>
              <div className="flex items-center gap-1">
                <img src={insomniaLogo} alt="Insomnia" className="h-5 w-5" />
                <span className="text-sm font-medium">Insomnia</span>
              </div>
            </div>
            <p className="text-sm text-(--hl)">
              Sync the latest changes from your Konnect organization into Insomnia. This will:
            </p>
            <ul className="flex flex-col gap-1 text-sm">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-font)" />
                Keep your local custom changes (never pushed to Konnect)
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-font)" />
                Update existing resources to match Konnect
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-(--color-font)" />
                Remove collections or environments tied to control planes, services, or routes deleted in Konnect
              </li>
            </ul>
          </div>
        ),
        yesText: 'Sync Now',
        noText: 'Cancel',
        color: 'surprise',
        onDone: async (confirmed: boolean) => {
          if (confirmed) {
            await syncKonnectProjectsAndNotify();
          }
        },
      });
    } else {
      await syncKonnectProjectsAndNotify();
    }
  };

  return {
    syncing,
    progress,
    cancelSync,
    handleSync,
    konnectSyncEnabled,
    lastSyncedAt,
    lastSyncResult,
    setLastSyncResult,
    showSyncDetails,
    setShowSyncDetails,
    skippedRoutesByReason,
    copiedReason,
    setCopiedReason,
    showKonnectConfigModal,
    setShowKonnectConfigModal,
    onDisconnect: () => {
      setLastSyncedAt(null);
      // Removing the last Konnect projects can hide the organization itself. Navigating away from
      // the now-invisible organization is handled declaratively by
      // `organization.$organizationId._index.tsx`'s loader, which every "no reachable project"
      // fallback already redirects through — not here, so it also covers deleting the last Konnect
      // project one at a time rather than only the bulk Disconnect path.
      refreshKonnectAccess(userSession.id, userSession.accountId, { force: true });
    },
  };
}

export type KonnectSyncBarState = ReturnType<typeof useKonnectSyncBar>;

/** The Cancel/Sync + gear buttons — rendered inline with the sidebar's search field. */
export function KonnectSyncActionsRow({
  syncing,
  cancelSync,
  handleSync,
  konnectSyncEnabled,
  lastSyncedAt,
  setShowKonnectConfigModal,
}: KonnectSyncBarState) {
  return (
    <div className="flex items-center gap-1">
      {syncing ? (
        <Button
          aria-label="Cancel sync"
          onPress={cancelSync}
          className="flex h-full items-center justify-center gap-1 rounded-xs border border-solid border-(--hl-sm) px-2 text-sm text-(--color-font) transition-all hover:bg-(--hl-xs) focus:outline-none"
        >
          Cancel
          <Icon icon="stop-circle" />
        </Button>
      ) : (
        <TooltipTrigger delay={300}>
          <Button
            aria-label="Sync Konnect"
            onPress={handleSync}
            isDisabled={!konnectSyncEnabled}
            className="flex h-full items-center justify-center gap-1 rounded-xs border border-solid border-(--hl-sm) px-2 text-sm text-(--color-font) transition-all hover:bg-(--hl-xs) focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon icon="refresh" />
            Sync
          </Button>
          <Tooltip
            placement="bottom"
            className="rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) px-3 py-1.5 text-xs text-(--color-font) shadow-lg select-none"
          >
            {konnectSyncEnabled ? (
              <LastSyncedLabel lastSyncedAt={lastSyncedAt ?? null} />
            ) : (
              'Your account does not have access to Konnect control planes.'
            )}
          </Tooltip>
        </TooltipTrigger>
      )}
      <Button
        aria-label="Konnect settings"
        onPress={() => setShowKonnectConfigModal(true)}
        className="flex aspect-square h-full items-center justify-center rounded-xs border border-solid border-(--hl-sm) px-2 text-sm text-(--color-font) transition-all hover:bg-(--hl-xs) focus:outline-none"
      >
        <Icon icon="gear" />
      </Button>
    </div>
  );
}

/** Sits right after the action row, mirroring where the full sidebar shows sync progress. */
export function KonnectSyncProgressLine({ syncing, progress }: KonnectSyncBarState) {
  if (!syncing) {
    return null;
  }
  return <p className="truncate px-4 pb-1 text-xs text-(--hl) italic">{progress}</p>;
}

/** The last-sync-result panel and the Konnect settings modal (both are self-guarding, so this is
 * safe to render unconditionally regardless of where in the layout it lands). */
export function KonnectSyncResultPanel({
  lastSyncResult,
  setLastSyncResult,
  showSyncDetails,
  setShowSyncDetails,
  skippedRoutesByReason,
  copiedReason,
  setCopiedReason,
  showKonnectConfigModal,
  setShowKonnectConfigModal,
  onDisconnect,
  konnectSyncEnabled,
}: KonnectSyncBarState) {
  return (
    <>
      {lastSyncResult && (
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
          <button
            className="-mt-2 shrink-0 text-xl text-(--hl) hover:text-(--color-font)"
            onClick={() => setLastSyncResult(null)}
          >
            <Icon icon="close" />
          </button>
        </div>
      )}

      {showKonnectConfigModal && (
        <KonnectSettingsModal
          onClose={() => setShowKonnectConfigModal(false)}
          onDisconnect={onDisconnect}
          konnectSyncEnabled={konnectSyncEnabled}
        />
      )}
    </>
  );
}

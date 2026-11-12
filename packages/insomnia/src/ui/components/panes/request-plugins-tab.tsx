import clsx from 'clsx';
import type { Project, Workspace } from 'insomnia-data';
import { type ReactNode, useState } from 'react';
import { Button } from 'react-aria-components';

import type { KonnectPlugin } from '../../../konnect/api';
import {
  getKonnectPluginCreateUrl,
  getKonnectPluginEditUrl,
  getKonnectPluginsUrl,
  getPluginDocsUrl,
  getPluginHubUrl,
  getPluginPriorityDocsUrl,
} from '../../../konnect/links';
import { SUGGESTED_PLUGINS } from '../../../konnect/plugin-catalog';
import {
  getPluginScopes,
  type KonnectLinkedRequest,
  type KonnectSyncedRoute,
  type PluginScope,
  resolveKonnectSyncedRoute,
  selectApplicablePlugins,
} from '../../../konnect/plugin-scope';
import { useKonnectPlugins } from '../../hooks/use-konnect-plugins';
import { Icon } from '../icon';
import { DeckCommandModal } from '../modals/deck-command-modal';

interface Props {
  activeRequest: KonnectLinkedRequest;
  activeWorkspace: Pick<Workspace, 'konnectServiceId'> | null | undefined;
  activeProject: Pick<Project, 'konnectControlPlaneId' | 'konnectRegion' | 'name'> | null | undefined;
}

type DeckModalState = { mode: 'edit'; plugin: KonnectPlugin } | { mode: 'add'; pluginName: string };

const SCOPE_LABELS: Record<PluginScope, string> = {
  route: 'Route',
  service: 'Service',
  consumer: 'Consumer',
  'consumer-group': 'Consumer Group',
  global: 'Global',
};

const ACTION_CLASS = 'rounded-xs px-2 py-1 text-xs text-(--hl) hover:bg-(--hl-xs) hover:text-(--color-font)';

/**
 * Keeps the action column on the same row while there is room for it, and
 * lets the left content wrap instead of pushing the buttons onto a new line.
 * Below the container breakpoint, the action column moves under the content.
 */
function PluginRowLayout({ children, actions }: { children: ReactNode; actions: ReactNode }) {
  return (
    <div className="@container border-b border-solid border-(--hl-md)">
      <div className="flex flex-col gap-2 px-4 py-2 @min-[42rem]:flex-row @min-[42rem]:items-center @min-[42rem]:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">{children}</div>
        <div className="flex shrink-0 flex-wrap items-center gap-1 self-start @min-[42rem]:self-center">{actions}</div>
      </div>
    </div>
  );
}

function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 bg-(--hl-xs) px-4 py-2">
      <div className="min-w-0">
        <h4 className="text-xs font-bold text-(--hl) uppercase">{title}</h4>
        {description && <p className="text-xs text-(--hl)">{description}</p>}
      </div>
      {action}
    </div>
  );
}

function PluginRow({
  plugin,
  syncedRoute,
  onShowDeck,
}: {
  plugin: KonnectPlugin;
  syncedRoute: KonnectSyncedRoute;
  onShowDeck: (plugin: KonnectPlugin) => void;
}) {
  const editUrl = getKonnectPluginEditUrl(syncedRoute.region, syncedRoute.controlPlaneId, plugin.name, plugin.id);
  const before = plugin.ordering?.before?.access ?? [];
  const after = plugin.ordering?.after?.access ?? [];

  return (
    <PluginRowLayout
      actions={
        <>
          <Button className={ACTION_CLASS} onPress={() => window.main.openInBrowser(getPluginDocsUrl(plugin.name))}>
            Docs
          </Button>
          {editUrl && (
            <Button className={ACTION_CLASS} onPress={() => window.main.openInBrowser(editUrl)}>
              Edit in Konnect
            </Button>
          )}
          <Button className={ACTION_CLASS} onPress={() => onShowDeck(plugin)}>
            decK command
          </Button>
        </>
      }
    >
      <span
        className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', plugin.enabled ? 'bg-green-500' : 'bg-(--hl-md)')}
        aria-hidden
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{plugin.instance_name ?? plugin.name}</span>
          {plugin.instance_name && <span className="shrink-0 text-xs text-(--hl)">{plugin.name}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--hl)">
          {getPluginScopes(plugin).map(scope => (
            <span key={scope}>{SCOPE_LABELS[scope]}</span>
          ))}
          {plugin.condition && <span title={plugin.condition}>Condition</span>}
          {before.length > 0 && <span>runs before {before.join(', ')}</span>}
          {after.length > 0 && <span>runs after {after.join(', ')}</span>}
        </div>
      </div>
    </PluginRowLayout>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center text-(--hl)">
      <span>{title}</span>
      <span className="max-w-lg text-xs">{detail}</span>
    </div>
  );
}

function ErrorState({
  title,
  detail,
  onRetry,
  isRetrying,
}: {
  title: string;
  detail: string;
  onRetry: () => void;
  isRetrying: boolean;
}) {
  return (
    <div role="alert" className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-(--color-danger-bg) text-(--color-danger)">
        <Icon icon="triangle-exclamation" className="size-4" aria-hidden />
      </span>
      <div className="flex max-w-lg flex-col gap-1">
        <p className="text-sm font-medium text-(--color-font)">{title}</p>
        <p className="text-xs break-words text-(--hl)">{detail}</p>
      </div>
      <Button
        className="inline-flex items-center gap-2 rounded-xs border border-solid border-(--hl-md) px-3 py-2 text-(--color-font) transition-colors hover:no-underline aria-disabled:opacity-50"
        isDisabled={isRetrying}
        onPress={onRetry}
      >
        <Icon icon="refresh" spin={isRetrying} />
        Retry
      </Button>
    </div>
  );
}

export const RequestPluginsTab = ({ activeRequest, activeWorkspace, activeProject }: Props) => {
  const [deckModal, setDeckModal] = useState<DeckModalState | null>(null);
  const syncedRoute = resolveKonnectSyncedRoute(activeRequest, activeWorkspace, activeProject);
  const { status, plugins, availableSuggestionNames, availabilityStatus, error, missingPat, isRefreshing, refresh } =
    useKonnectPlugins(syncedRoute);

  if (!activeProject?.konnectControlPlaneId) {
    return null;
  }

  if (!activeProject.konnectRegion) {
    return (
      <EmptyState
        title="This project is missing its Konnect region."
        detail="Re-sync Konnect for this project, then reopen this tab."
      />
    );
  }

  if (!syncedRoute) {
    return (
      <EmptyState
        title="This request isn't linked to a Konnect route."
        detail="Plugins can only be shown for requests synced from Kong Konnect."
      />
    );
  }

  if (status === 'loading') {
    return <div className="p-4 text-sm text-(--hl)">Loading plugins from Konnect…</div>;
  }

  if (status === 'error') {
    return (
      <ErrorState
        title={missingPat ? 'Konnect personal access token required' : 'Failed to load plugins'}
        detail={
          missingPat
            ? 'Configure a personal access token in Kong Konnect settings, then retry.'
            : (error ?? 'Konnect did not return an error message.')
        }
        onRetry={refresh}
        isRetrying={isRefreshing}
      />
    );
  }

  const selection = selectApplicablePlugins(plugins, syncedRoute);
  const suggestions =
    availabilityStatus === 'ready'
      ? SUGGESTED_PLUGINS.filter(
          plugin => !selection.appliedNames.includes(plugin.name) && availableSuggestionNames?.includes(plugin.name),
        ).slice(0, 6)
      : [];
  const allPlugins = selection.plugins;
  const enabledCount = allPlugins.filter(plugin => plugin.enabled).length;
  const conditionCount = allPlugins.filter(plugin => plugin.enabled && plugin.condition).length;
  const hasPlugins = allPlugins.length > 0;
  const pluginsUrl = getKonnectPluginsUrl(syncedRoute.region, syncedRoute.controlPlaneId);
  const deckContext = {
    controlPlaneName: syncedRoute.controlPlaneName,
    region: syncedRoute.region,
    routeId: syncedRoute.routeId,
  };

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto">
      <div className="@container border-b border-solid border-(--hl-md)">
        <div className="flex flex-col gap-2 p-4 @min-[42rem]:flex-row @min-[42rem]:items-center @min-[42rem]:justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-bold text-(--hl) uppercase">Konnect plugins</h3>
            {enabledCount === 0 ? (
              <p className="text-xs text-(--hl)">Insomnia does not resolve plugin precedence.</p>
            ) : (
              <p className="text-xs text-(--hl)">
                {enabledCount} enabled plugin {enabledCount === 1 ? 'instance' : 'instances'}
                {conditionCount > 0 ? `, ${conditionCount} conditional` : ''}. Insomnia does not resolve plugin
                precedence.
              </p>
            )}
            <Button
              className="mt-1 p-0 text-xs text-(--hl) underline hover:text-(--color-font)"
              onPress={() => window.main.openInBrowser(getPluginPriorityDocsUrl())}
            >
              How plugin priority works
            </Button>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-1 self-start @min-[42rem]:self-center">
            <Button
              className={`${ACTION_CLASS} inline-flex items-center gap-1`}
              isDisabled={isRefreshing}
              onPress={refresh}
            >
              <Icon icon="refresh" spin={isRefreshing} />
              Refresh
            </Button>
            {pluginsUrl && (
              <Button
                className="shrink-0 rounded-xs px-2 py-1 text-xs text-(--hl) hover:bg-(--hl-xs) hover:text-(--color-font)"
                onPress={() => window.main.openInBrowser(pluginsUrl)}
              >
                View all in Konnect
              </Button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="mx-4 my-3 flex items-start gap-2 rounded-xs border border-solid border-(--color-danger) bg-(--color-danger-bg) px-3 py-2"
        >
          <Icon icon="triangle-exclamation" className="mt-0.5 shrink-0 text-(--color-danger)" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-xs font-medium text-(--color-danger)">Failed to refresh plugins.</span>
            <span className="text-xs text-(--hl)">{error}</span>
            {missingPat && (
              <span className="text-xs text-(--hl)">
                Configure a Konnect personal access token in Kong Konnect settings.
              </span>
            )}
          </div>
          <Button className={`${ACTION_CLASS} shrink-0 self-center`} isDisabled={isRefreshing} onPress={refresh}>
            Retry
          </Button>
        </div>
      )}

      {!hasPlugins && (
        <div className="mx-4 my-3 flex items-start gap-2 rounded-xs border border-solid border-(--hl-md) bg-(--hl-xs) px-3 py-2">
          <Icon icon="info-circle" className="mt-0.5 shrink-0 text-(--hl)" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-xs font-medium text-(--color-font)">No plugins apply to this request.</span>
            <span className="text-xs text-(--hl)">
              Plugins configured on this route, its service, or the control plane will appear here.
            </span>
          </div>
        </div>
      )}

      {allPlugins.map(plugin => (
        <PluginRow
          key={plugin.id}
          plugin={plugin}
          syncedRoute={syncedRoute}
          onShowDeck={target => setDeckModal({ mode: 'edit', plugin: target })}
        />
      ))}

      {suggestions.length > 0 && (
        <section>
          <SectionHeader
            title="Suggested plugins"
            description="Commonly used plugins not applied to this route."
            action={
              <Button
                className="shrink-0 rounded-xs px-2 py-1 text-xs text-(--hl) hover:bg-(--hl-sm) hover:text-(--color-font)"
                onPress={() => window.main.openInBrowser(getPluginHubUrl())}
              >
                View all plugins
              </Button>
            }
          />
          {suggestions.map(suggestion => {
            const addUrl = getKonnectPluginCreateUrl(syncedRoute.region, syncedRoute.controlPlaneId, suggestion.name);
            return (
              <PluginRowLayout
                key={suggestion.name}
                actions={
                  <>
                    <Button
                      className={ACTION_CLASS}
                      onPress={() => window.main.openInBrowser(getPluginDocsUrl(suggestion.name))}
                    >
                      Docs
                    </Button>
                    {addUrl && (
                      <Button className={ACTION_CLASS} onPress={() => window.main.openInBrowser(addUrl)}>
                        Add in Konnect
                      </Button>
                    )}
                    <Button
                      className={ACTION_CLASS}
                      onPress={() => setDeckModal({ mode: 'add', pluginName: suggestion.name })}
                    >
                      decK command
                    </Button>
                  </>
                }
              >
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="font-medium">{suggestion.displayName}</span>
                  <span className="text-xs text-(--hl)">{suggestion.description}</span>
                </div>
              </PluginRowLayout>
            );
          })}
        </section>
      )}

      {deckModal?.mode === 'edit' && (
        <DeckCommandModal
          mode="edit"
          plugin={deckModal.plugin}
          context={deckContext}
          onHide={() => setDeckModal(null)}
        />
      )}
      {deckModal?.mode === 'add' && (
        <DeckCommandModal
          mode="add"
          pluginName={deckModal.pluginName}
          context={deckContext}
          onHide={() => setDeckModal(null)}
        />
      )}
    </div>
  );
};

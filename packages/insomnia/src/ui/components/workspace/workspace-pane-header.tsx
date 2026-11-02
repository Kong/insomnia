import { type McpRequest, models } from 'insomnia-data';
import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Button } from 'react-aria-components';
import { useLocation, useParams } from 'react-router';

import { isNotNullOrUndefined } from '~/common/misc';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useRequestLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.request.$requestId';
import { AnalyticsEvent } from '~/ui/analytics';
import { EnvironmentPicker } from '~/ui/components/environment-picker';
import { Icon } from '~/ui/components/icon';
import { useDocBodyKeyboardShortcuts } from '~/ui/components/keydown-binder';
import { CookiesModal } from '~/ui/components/modals/cookies-modal';
import { MCPCertificatesModal } from '~/ui/components/modals/mcp-certificates-modal';
import { CertificatesModal } from '~/ui/components/modals/workspace-certificates-modal';
import { WorkspaceEnvironmentsEditModal } from '~/ui/components/modals/workspace-environments-edit-modal';
import { PaneHeader } from '~/ui/components/pane-header';
import { useWorkspaceBreadcrumbs } from '~/ui/components/workspace/use-workspace-breadcrumb';
import uiEventBus, { OPEN_ENVIRONMENTS_MODAL } from '~/ui/event-bus';

export default function WorkspacePaneHeader({ hasSettings }: { hasSettings: boolean }) {
  const { organizationId } = useParams();
  const isScratchPad = organizationId ? models.organization.isScratchpadOrganizationId(organizationId) : false;
  const { activeCookieJar, caCertificate, clientCertificates, activeWorkspace } = useWorkspaceLoaderData()!;
  const { activeRequest } = useRequestLoaderData() || {};
  const breadcrumbs = useWorkspaceBreadcrumbs();

  // Opened by the environment picker's manage button, or by editors asking to show a
  // specific environment's source ("open variable source"). Rendered outside the
  // hasSettings gate so views without settings controls (e.g. the mock server) still
  // host it.
  const location = useLocation();
  const [environmentsModal, setEnvironmentsModal] = useState<{
    environmentId?: string;
    openedAtKey: string;
    requestId: number;
  } | null>(null);
  // Every "open" request bumps requestId so a request for an environment that is
  // already loaded still reselects it (the modal stays mounted between requests).
  const requestEnvironmentsModal = useCallback(
    (environmentId?: string) =>
      setEnvironmentsModal(prev => ({
        environmentId,
        openedAtKey: location.key,
        requestId: (prev?.requestId ?? 0) + 1,
      })),
    [location.key],
  );
  useEffect(() => {
    return uiEventBus.on(OPEN_ENVIRONMENTS_MODAL, environmentId => {
      requestEnvironmentsModal(environmentId);
    });
  }, [requestEnvironmentsModal]);

  // The modal belongs to the route it was opened on. "Open variable source" can
  // navigate to another surface (e.g. a folder environment) while the modal is
  // mounted; keeping it open would cover the page it navigated to. Any navigation,
  // including a search-only change such as ?tab=environment, gets a new key.
  // Close before paint so the modal never flashes over the destination.
  useLayoutEffect(() => {
    if (environmentsModal && environmentsModal.openedAtKey !== location.key) {
      setEnvironmentsModal(null);
    }
  }, [environmentsModal, location.key]);

  const realBreadcrumbs = useMemo(() => {
    if (breadcrumbs.length > 4) {
      return [
        breadcrumbs[0],
        breadcrumbs[1],
        {
          id: '_ellipsis',
          label: '...', // not interactive currently
        },
        breadcrumbs[breadcrumbs.length - 1],
      ];
    }
    return breadcrumbs;
  }, [breadcrumbs]);

  const [isEnvironmentPickerOpen, setIsEnvironmentPickerOpen] = useState(false);
  const [isProjectEnvironmentPickerOpen, setIsProjectEnvironmentPickerOpen] = useState(false);
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [isCertificatesModalOpen, setCertificatesModalOpen] = useState(false);

  useDocBodyKeyboardShortcuts({
    environment_showEditor: () => requestEnvironmentsModal(),
    environment_showSwitchMenu: () => setIsEnvironmentPickerOpen(true),
    environment_showSwitchProjectMenu: () => setIsProjectEnvironmentPickerOpen(true),
    showCookiesEditor: () => setIsCookieModalOpen(true),
  });

  const isMcp = activeWorkspace && models.workspace.isMcp(activeWorkspace);

  const caStatus = !isMcp
    ? null
    : ((activeRequest as McpRequest) || {})?.sslValidation === false
      ? 'warning'
      : caCertificate?.path && !caCertificate.disabled
        ? 'success'
        : 'default';

  return (
    <>
      <PaneHeader
        // For scratch pad, do not show project in breadcrumbs.
        breadcrumbs={isScratchPad ? realBreadcrumbs.slice(1) : realBreadcrumbs}
        rightSlot={
          hasSettings ? (
            <>
              <EnvironmentPicker
                isOpen={isEnvironmentPickerOpen}
                onOpenChange={isOpen => {
                  setIsEnvironmentPickerOpen(isOpen);
                  if (isOpen) {
                    window.main.trackAnalyticsEvent({
                      event: AnalyticsEvent.requestEnvironmentClicked,
                    });
                  }
                }}
                isProjectPickerOpen={isProjectEnvironmentPickerOpen}
                onProjectPickerOpenChange={isOpen => {
                  setIsProjectEnvironmentPickerOpen(isOpen);
                  if (isOpen) {
                    window.main.trackAnalyticsEvent({
                      event: AnalyticsEvent.requestEnvironmentClicked,
                    });
                  }
                }}
                onOpenEnvironmentSettingsModal={() => requestEnvironmentsModal()}
              />
              {!isMcp && (
                <Button
                  aria-label="Add Cookies"
                  onPress={() => {
                    window.main.trackAnalyticsEvent({
                      event: AnalyticsEvent.requestAddCookiesClicked,
                    });
                    setIsCookieModalOpen(true);
                  }}
                  className="flex h-7 items-center justify-center gap-2 rounded-xs px-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                >
                  <Icon icon="cookie-bite" className="w-4 shrink-0" />
                  <span className="truncate">
                    Cookies {activeCookieJar.cookies.length > 0 ? `(${activeCookieJar.cookies.length})` : ''}
                  </span>
                </Button>
              )}
              <Button
                aria-label="Add Certificates"
                onPress={() => {
                  window.main.trackAnalyticsEvent({
                    event: AnalyticsEvent.requestAddCertificatesClicked,
                  });
                  setCertificatesModalOpen(true);
                }}
                className="flex h-7 items-center justify-center gap-2 rounded-xs px-2 text-sm text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
              >
                <Icon icon="file-contract" className="w-4 shrink-0" />
                <span className="inline-flex items-center gap-1 truncate">
                  <span className="truncate">
                    Certificates{' '}
                    {!isMcp &&
                      ([...clientCertificates, caCertificate]
                        .filter(cert => !cert?.disabled)
                        .filter(isNotNullOrUndefined).length > 0
                        ? `(${[...clientCertificates, caCertificate].filter(cert => !cert?.disabled).filter(isNotNullOrUndefined).length})`
                        : '')}
                  </span>
                  {isMcp && caStatus !== 'default' && (
                    <Icon
                      icon="circle"
                      className={`${
                        {
                          success: 'text-(--color-success)',
                          warning: 'text-(--color-warning)',
                        }[caStatus!]
                      } h-2 w-2 shrink-0`}
                    />
                  )}
                </span>
              </Button>

              {/* Modals */}
              {!isMcp && isCookieModalOpen && <CookiesModal setIsOpen={setIsCookieModalOpen} />}
              {isCertificatesModalOpen &&
                (isMcp ? (
                  <MCPCertificatesModal onClose={() => setCertificatesModalOpen(false)} />
                ) : (
                  <CertificatesModal onClose={() => setCertificatesModalOpen(false)} />
                ))}
            </>
          ) : null
        }
      />
      {environmentsModal && (
        <WorkspaceEnvironmentsEditModal
          initialEnvironmentId={environmentsModal.environmentId}
          selectionRequestId={environmentsModal.requestId}
          onClose={() => setEnvironmentsModal(null)}
        />
      )}
    </>
  );
}

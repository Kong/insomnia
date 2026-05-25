import { useMemo, useState } from 'react';
import { Button } from 'react-aria-components';

import { isNotNullOrUndefined } from '~/common/misc';
import { type McpRequest, models } from '~/insomnia-data';
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

export default function WorkspacePaneHeader({ hasSettings }: { hasSettings: boolean }) {
  const { activeCookieJar, caCertificate, clientCertificates, activeWorkspace } = useWorkspaceLoaderData()!;
  const { activeRequest } = useRequestLoaderData() || {};
  const breadcrumbs = useWorkspaceBreadcrumbs();

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
  const [isEnvironmentModalOpen, setEnvironmentModalOpen] = useState(false);
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const [isCertificatesModalOpen, setCertificatesModalOpen] = useState(false);

  useDocBodyKeyboardShortcuts({
    environment_showEditor: () => setEnvironmentModalOpen(true),
    environment_showSwitchMenu: () => setIsEnvironmentPickerOpen(true),
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
    <PaneHeader
      breadcrumbs={realBreadcrumbs}
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
              onOpenEnvironmentSettingsModal={() => setEnvironmentModalOpen(true)}
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
                    ([...clientCertificates, caCertificate].filter(cert => !cert?.disabled).filter(isNotNullOrUndefined)
                      .length > 0
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
            {isEnvironmentModalOpen && (
              <WorkspaceEnvironmentsEditModal onClose={() => setEnvironmentModalOpen(false)} />
            )}
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
  );
}

import { config } from '@fortawesome/fontawesome-svg-core';
import type { IpcRendererEvent } from 'electron';
import { models, services } from 'insomnia-data';
import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { Button } from 'react-aria-components';
import {
  isRouteErrorResponse,
  Link as RouterLink,
  Links,
  matchPath,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useFetchers,
  useNavigate,
  useParams,
  useRevalidator,
} from 'react-router';
import { useLatest } from 'react-use';

import { EXTERNAL_VAULT_PLUGIN_NAME, isDevelopment } from '~/common/constants';
import { convertInsomniaDeepLink, parseDeepLinkUrl as parseImportDeepLinkUrl, resolveImportDeepLink } from '~/common/import-deep-link';
import { useCreateCloudCredentialActionFetcher } from '~/routes/cloud-credentials.create';
import {
  GIT_PROVIDER_COMPLETE_SIGN_IN_FETCHER_KEY,
  useGitProviderCompleteSignInFetcher,
} from '~/routes/git-credentials.complete-sign-in';
import { useWorkspaceLoaderData } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId';
import { useProjectNewActionFetcher } from '~/routes/organization.$organizationId.project.new';
import { AppLogo } from '~/ui/components/app-logo';
import { CopyButton } from '~/ui/components/base/copy-button';
import { Link } from '~/ui/components/base/link';
import { Icon } from '~/ui/components/icon';
import { showError, showModal } from '~/ui/components/modals';
import { AlertModal } from '~/ui/components/modals/alert-modal';
import { AskModal } from '~/ui/components/modals/ask-modal';
import { ImportModal, type ImportSource, validateCurl } from '~/ui/components/modals/import-modal/import-modal';
import { SettingsModal } from '~/ui/components/modals/settings-modal';
import { showToast, Toaster } from '~/ui/components/toast-notification';
import { VariableSourceTooltipHost } from '~/ui/components/variable-source-tooltip-host';
import { AppHooks } from '~/ui/containers/app-hooks';
import { ServerDataCacheProvider } from '~/ui/context/app/server-data-context';
import cssHref from '~/ui/css/styles.css?url';
import { useGlobalCurlPasteImport } from '~/ui/hooks/use-global-curl-paste-import';
import type { RootLoaderData } from '~/ui/hooks/use-root-loader-data';
import Modals from '~/ui/modals';
import { createPlugin } from '~/ui/plugins/create';
import { dimTitleBarWithDialogs, setTheme } from '~/ui/plugins/misc';
import { plugins } from '~/ui/plugins/renderer-bridge';
import { confirmOpenFolderTrust } from '~/ui/utils/git-folder-trust';

import type { Route } from './+types/root';

config.autoAddCss = false;

export const links: Route.LinksFunction = () => {
  return [
    { rel: 'stylesheet', href: cssHref, type: 'text/css' },
    { rel: 'icon', href: '/favicon.ico' },
    { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
    { rel: 'mask-icon', href: '/safari-pinned-tab.svg', color: '#5bbad5' },
  ];
};

const locationHistoryMiddleware: Route.ClientMiddlewareFunction = async ({ request }, next) => {
  await next();

  try {
    const url = new URL(request.url);
    const match = matchPath('/organization/:organizationId/*', url.pathname);

    if (!match || !match.params.organizationId) {
      return;
    }

    const organizationId = match.params.organizationId;
    window.localStorage.setItem(`locationHistoryEntry:${organizationId}`, url.pathname);
    window.localStorage.setItem('lastVisitedOrganizationId', organizationId);
  } catch (err) {
    console.log('[locationHistoryMiddleware] Failed to store location history entry', err);
  }
};
export const clientMiddleware: Route.ClientMiddlewareFunction[] = [locationHistoryMiddleware];

const parseDeepLinkUrl = (url: string) => parseImportDeepLinkUrl(url, isDevelopment());

export const ErrorBoundary: FC<Route.ErrorBoundaryProps> = ({ error }) => {
  const getErrorMessage = (err: any) => {
    if (isRouteErrorResponse(err)) {
      return typeof err.data === 'string' ? err.data : (err.data?.message ?? 'Unknown error');
    }
  };

  const getErrorStack = (err: any) => {
    if ('error' in err) {
      return err.error?.stack;
    }

    return err?.stack;
  };

  const errorMessage = getErrorMessage(error);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden">
      <h1 className="flex items-center gap-2 text-2xl text-(--color-font)">
        <Icon className="text-(--color-danger)" icon="exclamation-triangle" /> Application Error
      </h1>
      <p className="text-(--color-font)">
        Failed to render. Please report to{' '}
        <button
          className="font-bold underline"
          onClick={() => window.main.openInBrowser('https://github.com/outmanos/restless/issues')}
        >
          our Github Issues
        </button>
      </p>
      {errorMessage && (
        <div className="p-6 text-(--color-font)">
          <code className="p-2 wrap-break-word">{errorMessage}</code>
        </div>
      )}
      <div className="flex items-center gap-2">
        <RouterLink
          reloadDocument
          className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-base font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
          to="/organization"
        >
          Try to reload the app
        </RouterLink>
      </div>
      <div className="overflow-y-auto p-6 text-(--color-font)">
        <code className="p-2 break-all">{getErrorStack(error)}</code>
      </div>
    </div>
  );
};

export async function clientLoader(_args: Route.ClientLoaderArgs): Promise<RootLoaderData> {
  const settings = await services.settings.get();
  const userSession = await services.userSession.get();
  const cloudCredentials = await services.cloudCredential.all();

  return {
    settings,
    userSession,
    cloudCredentials,
  };
}

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en" className="size-full overflow-hidden">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          httpEquiv="Content-Security-Policy"
          content="
      font-src
            'self'
            data:
      ;
      connect-src
            'self'
            data:
            insomnia-templating-worker-database:
            https:
            http:
      ;
      default-src
            *
            restless://*
      ;
      img-src
            blob:
            data:
            *
            restless://*
      ;
      frame-src
            blob:
            *
            restless://*
      ;
      script-src
            'self'
            'unsafe-eval'
            'unsafe-inline'
      ;
      style-src
            'self'
            'unsafe-inline'
      ;
      media-src
            blob:
            data:
            mediastream:
            *
            restless://*
      ;
      "
        />
        <Meta />
        <Links />
      </head>
      <body className="size-full">
        {children}
        <ScrollRestoration />
        <Scripts />
        <div id="graphql-explorer-container" />
        <div id="hints-container" className="theme--dropdown__menu" />
      </body>
    </html>
  );
};

export const HydrateFallback = () => {
  return (
    <div id="app-loading-indicator" className="fixed top-0 left-0 flex h-full w-full items-center justify-center">
      <AppLogo width={72} height={72} className="animate-pulse" />
    </div>
  );
};

const Root = () => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId?: string;
  };

  // One record per import trigger: the source plus the context the trigger
  // knows. Deep-link imports carry no workspace context; pasting a cURL
  // inside a workspace carries its workspaceId.
  const [importTrigger, setImportTrigger] = useState<{
    source: ImportSource;
    workspaceId?: string;
  } | null>(null);

  // INS-3544: pasting a cURL while no editable surface has focus starts the
  // import flow. Inside a workspace the current collection is offered as the
  // default import target, which needs the workspace name for the modal header.
  const workspaceName = useWorkspaceLoaderData()?.activeWorkspace?.name;
  const handleCurlPaste = async (curl: string) => {
    // The Scratchpad project holds a single collection; keep the import flow
    // out of it so a paste cannot create extra collections there.
    if (
      !organizationId ||
      false
    ) {
      return;
    }
    const { isValid } = await validateCurl(curl);
    if (!isValid) {
      return;
    }
    setImportTrigger({
      source: {
        type: 'curl',
        defaultValue: curl,
        autoScan: true,
        startedAt: Date.now(),
      },
      workspaceId,
    });
  };
  // Only Root's own import modal state is tracked; Import modals opened from
  // other entry points are not, so pasting then can stack one more modal.
  useGlobalCurlPasteImport({ enabled: !importTrigger, onCurlPaste: handleCurlPaste });

  const { submit: createCloudCredentials } = useCreateCloudCredentialActionFetcher();
  const { submit: gitProviderCompleteSignInSubmit } = useGitProviderCompleteSignInFetcher({
    key: GIT_PROVIDER_COMPLETE_SIGN_IN_FETCHER_KEY,
  });
  const navigate = useNavigate();

  const { revalidate } = useRevalidator();
  // Used to adopt a folder opened from the OS — going through the project-creation
  // action (not a raw IPC) so React Router revalidates loaders afterwards.
  const openFolderFetcher = useProjectNewActionFetcher();
  const { submit: openFolderSubmit } = openFolderFetcher;
  const inflightFetchers = useFetchers();
  const ifInSubmission = inflightFetchers.some(f => f.formMethod === 'POST');
  const latestInSubmission = useLatest(ifInSubmission);

  useEffect(() => {
    const unsubGitDbSynced = window.main.on('git.db-synced', () => {
      if (!latestInSubmission.current) {
        revalidate();
      }
    });
    // Lives here rather than in renderer-listeners so the clear can revalidate loaders
    // afterwards - the response panes read their data from loaders, which a raw database
    // write does not refresh.
    const unsubClearResponseHistory = window.main.on('clear-all-response-history', () => {
      showModal(AlertModal, {
        title: 'Clear All Response History',
        message:
          'This will clear your local Response history across every project/collection. No functionality will be impacted, and this will not affect any other user. Do you wish to continue?',
        addCancel: true,
        okLabel: 'Continue',
        onConfirm: async () => {
          try {
            await services.helpers.removeAllResponseHistory();
            revalidate();
            showToast({ icon: 'trash', title: 'Response history cleared', status: 'success' });
          } catch (error) {
            // AlertModal does not await onConfirm, so an unreported failure would look exactly
            // like a successful clear. The clear can also stop part-way through, hence the
            // revalidate on this path too.
            revalidate();
            showError({ title: 'Failed to clear response history', error });
          }
        },
      });
    });
    return () => {
      unsubGitDbSynced();
      unsubClearResponseHistory();
    };
  }, [latestInSubmission, revalidate, navigate]);

  useEffect(() => dimTitleBarWithDialogs(), []);

  useEffect(() => {
    return window.main.on('git-device-code', (_: IpcRendererEvent, code: string) => {
      showModal(AlertModal, {
        title: 'Authorize on GitHub',
        message: `Enter code ${code} in the browser. It has been copied to your clipboard.`,
      });
    });
  }, []);

  useEffect(() => {
    return window.main.on('shell:open', async (_: IpcRendererEvent, link: string) => {
      let url: string | null = link;
      if (url.startsWith('insomnia://')) {
        const { handleInsomniaLinks } = await services.settings.get();
        url = handleInsomniaLinks ? convertInsomniaDeepLink(url) : null;
      }
      if (!url) {
        return;
      }
      const parsed = parseDeepLinkUrl(url);
      if (!parsed) {
        return;
      }
      const { urlWithoutParams, params } = parsed;
      if (urlWithoutParams === 'restless://app/alert') {
        return showModal(AlertModal, {
          title: params.title,
          message: params.message,
        });
      }
      // Open a local folder as a Git project (from the OS: Finder "Open With",
      // `insomnia /path/to/folder`, or this deep link). The main process has
      // already verified the path is an existing directory
      if (urlWithoutParams === 'restless://app/open-folder') {
        const folderPath = params.path;
        if (!folderPath) {
          return;
        }
        const targetOrg = models.organization.LOCAL_ORGANIZATION_ID;
        // Opening a folder from the OS adopts whatever it contains — confirm trust first.
        if (!(await confirmOpenFolderTrust(folderPath))) {
          return;
        }
        // Go through the project-creation action (not a raw IPC) so React Router
        // revalidates loaders and the sidebar/project list update; the action's
        // redirect navigates to the new project.
        return openFolderSubmit({
          organizationId: targetOrg,
          projectData: {
            name: window.path.basename(folderPath) || 'New Git Project',
            storageType: 'git',
            openExistingDirectory: folderPath,
          },
        });
      }
      // Supports params: uri, mcp, curl, clipboard, file, origin, endpoint, operationId
      if (urlWithoutParams === 'restless://app/import') {
        // Clean up the flag set during deep-link replay so it never leaks
        // into later modal evaluations within the same session.
        window.sessionStorage.removeItem('suppressWelcomeModals');

        const resource = resolveImportDeepLink(params);
        if (!resource) {
          return;
        }
        // Only value-bearing uri/mcp/cURL resources auto-scan; bare params
        // (e.g. `?clipboard`) just open the modal with the tab selected.
        const autoScan =
          !!resource.defaultValue &&
          (resource.type === 'curl'
            ? (await validateCurl(resource.defaultValue)).isValid
            : resource.type === 'uri' || resource.type === 'mcp');
        return setImportTrigger({
          source: {
            ...resource,
            autoScan,
            startedAt: Date.now(),
          },
        });
      }
      if (urlWithoutParams === 'restless://plugins/install') {
        if (!params.name || params.name.trim() === '') {
          return showError({
            title: 'Plugin Install',
            message: 'Plugin name is required',
          });
        }

        return showModal(AskModal, {
          title: 'Plugin Install',
          message: (
            <p className="text-(--hl)">
              Do you want to install <i className="font-bold text-(--hl)">{params.name}</i>?
            </p>
          ),
          yesText: 'Install',
          noText: 'Cancel',
          onDone: async (isYes: boolean) => {
            if (isYes) {
              try {
                // TODO (pavkout): Remove second parameter when we will decide about the @scoped packages name validation
                await window.main.installPlugin(params.name.trim(), true);
                showModal(SettingsModal, { tab: 'plugins' });
              } catch (err) {
                showError({
                  title: 'Plugin Install',
                  message: 'Failed to install plugin',
                  error: err.message,
                });
              }
            }
          },
        });
      }
      if (urlWithoutParams === 'restless://plugins/theme') {
        const parsedTheme = JSON.parse(decodeURIComponent(params.theme));
        showModal(AskModal, {
          title: 'Install Theme',
          message: (
            <>
              Do you want to install <code>{parsedTheme.displayName}</code>?
            </>
          ),
          yesText: 'Install',
          noText: 'Cancel',
          onDone: async (isYes: boolean) => {
            if (isYes) {
              const mainJsContent = `module.exports.themes = [${JSON.stringify(parsedTheme, null, 2)}];`;
              await createPlugin(`theme-${parsedTheme.name}`, mainJsContent);
              const settings = await services.settings.get();
              await services.settings.update(settings, {
                theme: parsedTheme.name,
              });
              await plugins.reloadPlugins();
              await setTheme(parsedTheme.name);
              showModal(SettingsModal, { tab: 'themes' });
            }
          },
        });
      }
      if (
        urlWithoutParams === 'restless://oauth/github/authenticate' ||
        urlWithoutParams === 'restless://oauth/github-app/authenticate'
      ) {
        const { code, state } = params;
        return gitProviderCompleteSignInSubmit({
          code,
          state,
          provider: 'github',
        });
      }
      if (urlWithoutParams === 'restless://oauth/gitlab/authenticate') {
        const { code, state } = params;
        return gitProviderCompleteSignInSubmit({
          code,
          state,
          provider: 'gitlab',
        });
      }
      if (urlWithoutParams === 'restless://oauth/azure/authenticate') {
        const { code, ...restParams } = params;
        if (code && typeof code === 'string') {
          const authResult = (await plugins.executePluginMainAction({
            pluginName: EXTERNAL_VAULT_PLUGIN_NAME,
            actionName: 'exchangeCode',
            params: { provider: 'azure', code },
          })) as any;
          const { success, result, error } = authResult;
          if (success) {
            const { account, uniqueId } = result!;
            const name = account?.username || uniqueId;
            createCloudCredentials({
              name,
              credentials: result,
              provider: 'azure',
              isAuthenticated: true,
            });
            const closeModalBtn = document.getElementById('close-add-cloud-credential-modal');
            if (closeModalBtn) {
              // close the modal to hint user Azure oauth url if exists
              closeModalBtn.click();
            }
            showModal(SettingsModal, { tab: 'credentials' });
          } else {
            showError({
              title: 'Azure Authorization Failed',
              message: error?.errorMessage,
            });
          }
        } else {
          const errorDetailKeys = Object.keys(restParams);
          const { error, error_description, error_uri } = restParams;
          if (error && error_description) {
            showError({
              title: 'Azure Authorization Failed',
              message: (
                <div className="flex flex-col gap-1 text-left">
                  <span className="text-lg font-bold">{error}</span>
                  <span className="whitespace-normal">{error_description}</span>
                  {error_uri && (
                    <div className="mt-2 flex items-center justify-center">
                      <Link button className="btn btn--clicky w-80" href={error_uri}>
                        View Document <i className="fa fa-external-link" />
                      </Link>
                    </div>
                  )}
                  <CopyButton
                    size="small"
                    className="absolute top-(--padding-sm) right-(--padding-sm)"
                    content={error_description}
                    title="Copy Description"
                    style={{ borderWidth: 0 }}
                  >
                    <i className="fa fa-copy" />
                  </CopyButton>
                </div>
              ),
            });
          } else {
            showError({
              title: 'Azure Authorization Failed',
              message: (
                <div className="flex flex-col gap-1 text-left">
                  {errorDetailKeys.length > 0
                    ? errorDetailKeys.map(k => (
                        <span key={k} className="whitespace-normal">
                          {k}: {restParams[k]}
                        </span>
                      ))
                    : 'Unknown error'}
                </div>
              ),
            });
          }
        }
      }
      console.log(`Unknown deep link: ${url}`);
    });
  }, [
    createCloudCredentials,
    gitProviderCompleteSignInSubmit,
    navigate,
    openFolderSubmit,
    organizationId,
    projectId,
    ]);

  // Surface failures from adopting an OS-opened folder (e.g. unreadable folder or
  // a collision with an existing project).
  useEffect(() => {
    if (openFolderFetcher.state === 'idle' && openFolderFetcher.data?.error) {
      showModal(AlertModal, { title: 'Could not open folder', message: openFolderFetcher.data.error });
    }
  }, [openFolderFetcher.data, openFolderFetcher.state]);

  useEffect(() => {
    const STORAGE_KEY = 'plugin-system-changes-toast-shown';
    if (localStorage.getItem(STORAGE_KEY)) {
      return;
    }
    Promise.resolve().then(() => {
      plugins.getPlugins().then(allPlugins => {
        const userPlugins = allPlugins.filter(p => p.directory !== '');
        if (userPlugins.length > 0) {
          showToast(
            {
              title: 'Plugin system updated',
              description: (
                <>
                  You are running at least one plug-in that may be impacted.{' '}
                  <Button
                    onClick={() => window.main.openInBrowser('https://github.com/outmanos/restless/releases')}
                    className="cursor-pointer border-0 bg-transparent p-0 text-(--color-link) underline"
                  >
                    Learn more
                  </Button>
                </>
              ),
              status: 'info',
            },
            { timeout: null },
          );
          localStorage.setItem(STORAGE_KEY, 'true');
        }
      });
    });
  }, []);

  return (
    <ServerDataCacheProvider>
      <div className="app">
        <Outlet />
        <Toaster />
      </div>
      <Modals />
      <VariableSourceTooltipHost />
      <AppHooks />
      {/* triggered by restless://app/import and pasting a cURL with no focus */}
      {importTrigger && (
        <ImportModal
          key={importTrigger.source.startedAt}
          onHide={() => setImportTrigger(null)}
          defaultProjectId={projectId}
          organizationId={organizationId}
          workspaceName={workspaceName}
          defaultWorkspaceId={importTrigger.workspaceId}
          from={importTrigger.source}
        />
      )}
    </ServerDataCacheProvider>
  );
};

export default Root;

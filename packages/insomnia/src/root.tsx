import { config } from '@fortawesome/fontawesome-svg-core';
import type { IpcRendererEvent } from 'electron';
import type { FC } from 'react';
import { useEffect, useState } from 'react';
import { Button } from 'react-aria-components';
import {
  href,
  isRouteErrorResponse,
  Link as RouterLink,
  Links,
  matchPath,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigate,
  useParams,
  useRouteLoaderData,
} from 'react-router';

import { EXTERNAL_VAULT_PLUGIN_NAME, isDevelopment } from '~/common/constants';
import { services, type Settings } from '~/insomnia-data';
import * as models from '~/models';
import type { UserSession } from '~/models/user-session';
import { executePluginMainAction, reloadPlugins } from '~/plugins';
import { createPlugin } from '~/plugins/create';
import { setTheme } from '~/plugins/misc';
import { useAuthorizeActionFetcher } from '~/routes/auth.authorize';
import { useDefaultBrowserRedirectActionFetcher } from '~/routes/auth.default-browser-redirect';
import { useLogoutFetcher } from '~/routes/auth.logout';
import { useCreateCloudCredentialActionFetcher } from '~/routes/cloud-credentials.create';
import { useGitProviderCompleteSignInFetcher } from '~/routes/git-credentials.complete-sign-in';
import type { SourceType } from '~/routes/import.scan';
import { SegmentEvent } from '~/ui/analytics';
import { getLoginUrl } from '~/ui/auth-session-provider.client';
import { CopyButton } from '~/ui/components/base/copy-button';
import { Link } from '~/ui/components/base/link';
import { Icon } from '~/ui/components/icon';
import { showError, showModal } from '~/ui/components/modals';
import { AlertModal } from '~/ui/components/modals/alert-modal';
import { AskModal } from '~/ui/components/modals/ask-modal';
import { ImportModal } from '~/ui/components/modals/import-modal/import-modal';
import { SettingsModal } from '~/ui/components/modals/settings-modal';
import { Toaster } from '~/ui/components/toast-notification';
import { AppHooks } from '~/ui/containers/app-hooks';
import cssHref from '~/ui/css/styles.css?url';
import Modals from '~/ui/modals';

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
const sanitizeUrlAndExtractOrigin = (url: string) => {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return '';
  }
};
export const clientMiddleware: Route.ClientMiddlewareFunction[] = [locationHistoryMiddleware];

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
  const logoutFetcher = useLogoutFetcher();

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden">
      <h1 className="flex items-center gap-2 text-2xl text-(--color-font)">
        <Icon className="text-(--color-danger)" icon="exclamation-triangle" /> Application Error
      </h1>
      <p className="text-(--color-font)">
        Failed to render. Please report to{' '}
        <a className="font-bold underline" href="https://github.com/Kong/insomnia/issues">
          our Github Issues
        </a>
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
        <Button
          className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-4 py-1 text-base font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
          onPress={() => logoutFetcher.submit()}
        >
          Logout{' '}
          <span>{logoutFetcher.state === 'loading' ? <Icon icon="spinner" className="animate-spin" /> : null}</span>
        </Button>
      </div>
      <div className="overflow-y-auto p-6 text-(--color-font)">
        <code className="p-2 break-all">{getErrorStack(error)}</code>
      </div>
    </div>
  );
};

export interface RootLoaderData {
  settings: Settings;
  workspaceCount: number;
  userSession: UserSession;
}

export const useRootLoaderData = () => {
  return useRouteLoaderData<typeof clientLoader>('root');
};

export async function clientLoader(_args: Route.ClientLoaderArgs) {
  const settings = await services.settings.get();
  const workspaceCount = await models.workspace.count();
  const userSession = await models.userSession.getOrCreate();
  const cloudCredentials = await models.cloudCredential.all();

  return {
    settings,
    workspaceCount,
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
            insomnia-event-source:
            insomnia-templating-worker-database:
            https:
            http:
      ;
      default-src
            *
            insomnia://*
      ;
      img-src
            blob:
            data:
            *
            insomnia://*
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
            insomnia://*
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
      <div className="relative">
        <svg viewBox="0 0 378 378" xmlns="http://www.w3.org/2000/svg" fillRule="evenodd" clipRule="evenodd" width="100">
          <circle
            cx="36"
            cy="36"
            r="36"
            fill="none"
            stroke="var(--hl, rgb(130, 130, 130))"
            strokeOpacity="0.1"
            strokeWidth="4px"
            transform="translate(-323 -111) translate(359.016 147.016) scale(4.24956)"
          />
          <circle
            cx="36"
            cy="36"
            r="36"
            fill="none"
            stroke="var(--hl, rgb(130, 130, 130))"
            strokeOpacity="0.8"
            strokeWidth="4px"
            strokeDasharray="56,172,0,0"
            transform="translate(-323 -111) translate(359.016 147.016) scale(4.24956)"
          >
            <animateTransform
              attributeName="transform"
              type="rotate"
              from="0 36 36"
              to="360 36 36"
              dur="0.8s"
              repeatCount="indefinite"
              additive="sum"
            />
          </circle>
          <path
            d="M19 37.033c9.96 0 18.033-8.073 18.033-18.033S28.96.967 19 .967.967 9.04.967 19 9.04 37.033 19 37.033z"
            fill="#fff"
            fillRule="nonzero"
            transform="translate(-323 -111) translate(431.258 219.258) scale(4.24956)"
          />
          <path
            d="M19 0C8.506 0 0 8.506 0 19s8.506 19 19 19 19-8.506 19-19S29.494 0 19 0zm0 1.932c9.426 0 17.068 7.642 17.068 17.068 0 9.426-7.642 17.068-17.068 17.068-9.426 0-17.068-7.642-17.068-17.068C1.932 9.574 9.574 1.932 19 1.932z"
            fill="#4000bf"
            fillRule="nonzero"
            transform="translate(-323 -111) translate(431.258 219.258) scale(4.24956)"
          />
          <path
            d="M19.214 5.474c7.47 0 13.525 6.057 13.525 13.526 0 7.469-6.055 13.526-13.525 13.526-7.47 0-13.526-6.057-13.526-13.526 0-1.825.362-3.567 1.019-5.156a5.266 5.266 0 004.243 2.15c2.885 0 5.26-2.375 5.26-5.261a5.263 5.263 0 00-2.15-4.242 13.5 13.5 0 015.154-1.017z"
            fill="url(#_Linear1)"
            transform="translate(-323 -111) translate(431.258 219.258) scale(4.24956)"
          />
          <defs>
            <linearGradient
              id="_Linear1"
              x1="0"
              y1="0"
              x2="1"
              y2="0"
              gradientUnits="userSpaceOnUse"
              gradientTransform="rotate(-90 25.87 6.655) scale(27.0508)"
            >
              <stop offset="0" stopColor="#7400e1" />
              <stop offset="1" stopColor="#4000bf" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
};

const Root = () => {
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
  };

  const [importObject, setImportObject] = useState({ type: 'clipboard', defaultValue: '' } as {
    type: SourceType;
    defaultValue: string;
    origin?: string;
  });
  const { submit: createCloudCredentials } = useCreateCloudCredentialActionFetcher();
  const { submit: authorizeSubmit } = useAuthorizeActionFetcher();
  const { submit: logoutSubmit } = useLogoutFetcher();
  const { submit: redirectToDefaultBrowserSubmit } = useDefaultBrowserRedirectActionFetcher();
  const { submit: gitProviderCompleteSignInSubmit } = useGitProviderCompleteSignInFetcher();
  const navigate = useNavigate();

  useEffect(() => {
    return window.main.on('shell:open', async (_: IpcRendererEvent, url: string) => {
      // Get the url without params
      let parsedUrl;
      try {
        parsedUrl = new URL(url);
      } catch {
        console.log('[deep-link] Invalid args, expected insomnia://x/y/z', url);
        return;
      }
      let urlWithoutParams = url.slice(0, Math.max(0, url.indexOf('?'))) || url;
      const params = Object.fromEntries(parsedUrl.searchParams);
      // Change protocol for dev redirects to match switch case
      if (isDevelopment()) {
        urlWithoutParams = urlWithoutParams.replace('insomniadev://', 'insomnia://');
      }
      if (urlWithoutParams === 'insomnia://app/alert') {
        return showModal(AlertModal, {
          title: params.title,
          message: params.message,
        });
      }
      if (urlWithoutParams === 'insomnia://app/auth/login') {
        if (params.message) {
          window.localStorage.setItem('logoutMessage', params.message);
        }

        return logoutSubmit();
      }
      // Supports params: uri, curl, origin
      if (urlWithoutParams === 'insomnia://app/import') {
        window.main.trackSegmentEvent({
          event: SegmentEvent.importStarted,
          properties: {
            source: 'import-url',
          },
        });

        if (params.uri) {
          return setImportObject({
            type: 'uri',
            defaultValue: params.uri,
            origin: sanitizeUrlAndExtractOrigin(params.origin),
          });
        }
        if (params.curl) {
          return setImportObject({
            type: 'curl',
            defaultValue: params.curl,
            origin: sanitizeUrlAndExtractOrigin(params.origin),
          });
        }
      }
      if (urlWithoutParams === 'insomnia://plugins/install') {
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
      if (urlWithoutParams === 'insomnia://plugins/theme') {
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
              await reloadPlugins();
              await setTheme(parsedTheme.name);
              showModal(SettingsModal, { tab: 'themes' });
            }
          },
        });
      }
      if (
        urlWithoutParams === 'insomnia://oauth/github/authenticate' ||
        urlWithoutParams === 'insomnia://oauth/github-app/authenticate'
      ) {
        const { code, state } = params;
        return gitProviderCompleteSignInSubmit({
          code,
          state,
          provider: 'github',
        });
      }
      if (urlWithoutParams === 'insomnia://oauth/gitlab/authenticate') {
        const { code, state } = params;
        return gitProviderCompleteSignInSubmit({
          code,
          state,
          provider: 'gitlab',
        });
      }
      if (urlWithoutParams === 'insomnia://app/auth/finish') {
        return authorizeSubmit({
          code: params.box,
        });
      }
      if (urlWithoutParams === 'insomnia://app/open/organization') {
        // if user is logged out, navigate to authorize instead
        // gracefully handle open org in app from browser
        const userSession = await models.userSession.getOrCreate();
        if (!userSession.id || userSession.id === '') {
          const url = new URL(getLoginUrl());
          window.main.openInBrowser(url.toString());
          window.localStorage.setItem('specificOrgRedirectAfterAuthorize', params.organizationId);
          return navigate(href('/auth/authorize'));
        }
        return navigate(`/organization/${params.organizationId}`);
      }
      if (urlWithoutParams === 'insomnia://system-browser-oauth/redirect') {
        const { url: redirectUrl, encryptedUrl: encryptedRedirectUrl, encryptedKey, iv } = params;
        if (redirectUrl) {
          return redirectToDefaultBrowserSubmit({
            redirectUrl,
          });
        } else if (encryptedRedirectUrl && encryptedKey && iv) {
          return redirectToDefaultBrowserSubmit({
            encryptedRedirectUrl,
            encryptedKey,
            iv,
          });
        }
        return;
      }
      if (urlWithoutParams === 'insomnia://oauth/azure/authenticate') {
        const { code, ...restParams } = params;
        if (code && typeof code === 'string') {
          const authResult = await executePluginMainAction({
            pluginName: EXTERNAL_VAULT_PLUGIN_NAME,
            actionName: 'exchangeCode',
            params: { provider: 'azure', code },
          });
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
    authorizeSubmit,
    createCloudCredentials,
    gitProviderCompleteSignInSubmit,
    logoutSubmit,
    navigate,
    redirectToDefaultBrowserSubmit,
  ]);

  return (
    <>
      <div className="app">
        <Outlet />
        <Toaster />
      </div>
      <Modals />
      <AppHooks />
      {/* triggered by insomnia://app/import */}
      {importObject.defaultValue && (
        <ImportModal
          onHide={() => setImportObject({ type: 'clipboard', defaultValue: '' })}
          projectName="Insomnia"
          defaultProjectId={projectId}
          organizationId={organizationId}
          from={importObject}
        />
      )}
    </>
  );
};

export default Root;

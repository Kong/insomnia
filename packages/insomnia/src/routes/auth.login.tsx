import { useEffect, useState } from 'react';
import { Button } from 'react-aria-components';
import { href, redirect, useNavigate } from 'react-router';

import { models } from '~/insomnia-data';
import { SCRATCHPAD_ORGANIZATION_ID } from '~/models/organization';
import { SCRATCHPAD_PROJECT_ID } from '~/models/project';
import { SegmentEvent } from '~/ui/analytics';
import { getLoginUrl } from '~/ui/auth-session-provider.client';
import { Icon } from '~/ui/components/icon';
import { Tooltip } from '~/ui/components/tooltip';
import { createFetcherSubmitHook } from '~/utils/router';

import type { Route } from './+types/auth.login';

const GoogleIcon = (props: React.ReactSVGElement['props']) => {
  return (
    <svg {...props} viewBox="0 0 22 22">
      <path
        d="M19.9885 9.20471H19.2502V9.16667H11.0002V12.8333H16.1807C15.4249 14.9678 13.394 16.5 11.0002 16.5C7.96279 16.5 5.50016 14.0374 5.50016 11C5.50016 7.96263 7.96279 5.5 11.0002 5.5C12.4022 5.5 13.6777 6.02892 14.649 6.89288L17.2417 4.30009C15.6046 2.77429 13.4147 1.83334 11.0002 1.83334C5.93787 1.83334 1.8335 5.93771 1.8335 11C1.8335 16.0623 5.93787 20.1667 11.0002 20.1667C16.0625 20.1667 20.1668 16.0623 20.1668 11C20.1668 10.3854 20.1036 9.78542 19.9885 9.20471Z"
        fill="#FFC107"
      />
      <path
        d="M2.89014 6.73338L5.90185 8.94209C6.71676 6.9245 8.69035 5.5 10.9999 5.5C12.4019 5.5 13.6775 6.02892 14.6487 6.89288L17.2415 4.30009C15.6043 2.77429 13.4144 1.83334 10.9999 1.83334C7.47897 1.83334 4.42555 3.82113 2.89014 6.73338Z"
        fill="#FF3D00"
      />
      <path
        d="M11 20.1667C13.3677 20.1667 15.5191 19.2605 17.1458 17.787L14.3087 15.3863C13.3884 16.0834 12.2444 16.5 11 16.5C8.61573 16.5 6.59127 14.9797 5.82861 12.8581L2.83936 15.1612C4.35644 18.1298 7.43736 20.1667 11 20.1667Z"
        fill="#4CAF50"
      />
      <path
        d="M19.9884 9.20471H19.25V9.16666H11V12.8333H16.1805C15.8175 13.8586 15.158 14.7427 14.3073 15.3867C14.3078 15.3862 14.3083 15.3862 14.3087 15.3858L17.1458 17.7865C16.945 17.969 20.1667 15.5833 20.1667 11C20.1667 10.3854 20.1034 9.78541 19.9884 9.20471Z"
        fill="#1976D2"
      />
    </svg>
  );
};

export async function clientAction({ request }: Route.ClientActionArgs) {
  const data = await request.formData();
  const provider = data.get('provider');
  const url = new URL(getLoginUrl());

  if (typeof provider === 'string' && provider) {
    url.searchParams.set('provider', provider);
  }

  window.main.openInBrowser(url.toString());

  return redirect(href('/auth/login-tip'));
}

export const useLoginActionFetcher = createFetcherSubmitHook(
  submit => (data: { provider: string }) => {
    submit(data, {
      action: href('/auth/login'),
      method: 'POST',
    });
  },
  clientAction,
);

const Component = () => {
  const loginFetcher = useLoginActionFetcher();
  const navigate = useNavigate();
  const [message, setMessage] = useState<string | null>(null);

  const login = (provider: string) => {
    loginFetcher.submit({
      provider,
    });
  };

  const logoutMessage = window.localStorage.getItem('logoutMessage');
  useEffect(() => {
    if (logoutMessage) {
      window.localStorage.removeItem('logoutMessage');
      setMessage(logoutMessage);
    }
  }, [logoutMessage]);

  return (
    <div className="flex flex-col gap-(--padding-lg)">
      <div className="flex flex-col gap-(--padding-md)">
        <p className="py-(--padding-md) text-center text-2xl text-(--color-font)">Get started for free</p>
        <div className="text-sm font-extrabold text-balance">
          <span className="inline-flex h-[calc(var(--text-sm)*(var(--leading-tight)))] flex-col overflow-hidden text-indigo-300">
            <ul className="animate-text-slide-4 block text-right leading-tight [&_li]:block">
              <li>Debug</li>
              <li>Design</li>
              <li>Test</li>
              <li>Mock</li>
              <li aria-hidden="true">Debug</li>
            </ul>
          </span>
          <span className="ml-1 text-(--color-font)">APIs locally, on Git or in the Cloud.</span>
        </div>
        {message && <div className="text-sm font-bold text-red-300">{message}</div>}
        <Button
          aria-label="Continue with Google"
          onPress={() => {
            login('google');
          }}
          className="flex w-full items-center justify-center gap-(--padding-md) rounded-md border border-solid border-(--hl-md) text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
        >
          <div className="flex h-[35px] w-[40px] items-center justify-center border-r border-solid border-(--hl-sm) bg-(--hl-xs)">
            <GoogleIcon width="1em" />
          </div>
          <span className="items flex-1">Continue with Google</span>
        </Button>
        <Button
          aria-label="Continue with GitHub"
          onPress={() => {
            login('github');
          }}
          className="flex w-full items-center justify-center gap-(--padding-md) rounded-md border border-solid border-(--hl-md) text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
        >
          <div className="flex h-[35px] w-[40px] items-center justify-center border-r border-solid border-(--hl-sm) bg-(--hl-xs)">
            <Icon icon={['fab', 'github']} />
          </div>
          <span className="items flex-1">Continue with GitHub</span>
        </Button>
        <Button
          aria-label="Continue with Email"
          onPress={() => {
            login('email');
          }}
          className="flex w-full items-center justify-center gap-(--padding-md) rounded-md border border-solid border-(--hl-md) text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
        >
          <div className="flex h-[35px] w-[40px] items-center justify-center border-r border-solid border-(--hl-sm) bg-(--hl-xs)">
            <Icon icon="envelope" />
          </div>
          <span className="items flex-1">Continue with Email</span>
        </Button>
        <Button
          aria-label="Continue with SSO"
          onPress={() => {
            login('sso');
          }}
          className="flex w-full items-center justify-center gap-(--padding-md) rounded-md border border-solid border-(--hl-md) text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
        >
          <div className="flex h-[35px] w-[40px] items-center justify-center border-r border-solid border-(--hl-sm) bg-(--hl-xs)">
            <Icon icon="key" />
          </div>
          <span className="items flex-1">Continue with SSO</span>
        </Button>

        <div className="flex items-center justify-between gap-(--padding-xs) text-sm text-[rgba(var(--color-font-rgb),0.8)]">
          <p>Or, start right away with limited capabilities</p>
          <Tooltip position="top" message="Collections only, sign in later to save, sync, or share." wide>
            <Icon icon="circle-info" />
          </Tooltip>
        </div>

        <Button
          onPress={() => {
            window.main.trackSegmentEvent({
              event: SegmentEvent.selectScratchpad,
            });
            navigate(
              href('/organization/:organizationId/project/:projectId/workspace/:workspaceId/debug', {
                organizationId: SCRATCHPAD_ORGANIZATION_ID,
                projectId: SCRATCHPAD_PROJECT_ID,
                workspaceId: models.workspace.SCRATCHPAD_WORKSPACE_ID,
              }),
            );
          }}
          aria-label="Use local Scratch Pad"
          className="flex w-full items-center justify-center gap-(--padding-md) rounded-md border border-solid border-(--hl-md) text-base text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
        >
          <div className="flex h-[35px] w-[40px] items-center justify-center border-r border-solid border-(--hl-sm) bg-(--hl-xs)">
            <Icon icon="code" />
          </div>
          <span className="items flex-1">Use local Scratch Pad</span>
        </Button>

        <p className="text-center text-xs text-[rgba(var(--color-font-rgb),0.8)]">
          By signing up or using Insomnia, you agree to the{' '}
          <a
            className="font-bold outline-hidden transition-colors hover:text-(--color-font) focus:text-(--color-font)"
            href="https://insomnia.rest/terms"
            rel="noreferrer"
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            className="font-bold outline-hidden transition-colors hover:text-(--color-font) focus:text-(--color-font)"
            href="https://insomnia.rest/privacy"
            rel="noreferrer"
          >
            Privacy Policy
          </a>{' '}
          agreement.
        </p>
      </div>
    </div>
  );
};

export default Component;

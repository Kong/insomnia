import type { DevPortalProject } from 'insomnia-data';
import React, { useState } from 'react';
import { Button } from 'react-aria-components';

interface Props {
  project: DevPortalProject;
}

export const DevPortalProjectEmptyView = ({ project }: Props) => {
  const { devPortalName, devPortalUrl, _id: projectId } = project;
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const handleLogin = async () => {
    setStatus('loading');
    setErrorMessage(undefined);
    try {
      const accessToken = await window.main.devPortal.oauthLogin({ projectId });
      setStatus('idle');
      console.log(accessToken);
    } catch (err) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : 'Failed to log in to the dev portal.');
    }
  };

  return (
    <div className="flex h-full w-full flex-col items-center gap-3 pt-[15%] text-center">
      <span className="text-xl font-semibold">{`Bring in APIs from the ${devPortalName} dev portal`}</span>
      <span>{`The ${devPortalName} dev portal was added to your org by an Insomnia admin. Login to ${devPortalName} to automatically pull in your testing setup.`}</span>
      <div className="mt-(--padding-sm) flex w-full flex-wrap justify-center gap-(--padding-md)">
        <span>
          Portal link:{' '}
          <a href={devPortalUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {devPortalUrl}
          </a>
          ↗️
        </span>
      </div>
      <div className="mt-(--padding-sm) flex w-full flex-wrap justify-center gap-(--padding-md)">
        <Button
          aria-label="Login to Portal"
          isDisabled={status === 'loading'}
          className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all focus:ring-(--hl-md) focus:ring-inset disabled:opacity-60 aria-pressed:opacity-80"
          onPress={handleLogin}
        >
          {status === 'loading' && <i className="fa fa-spinner fa-spin mr-2" />}
          {status === 'loading' ? 'Logging in…' : 'Login to Portal'}
        </Button>
      </div>
      {status === 'error' && (
        <div className="mt-(--padding-sm) max-w-lg rounded-md border border-solid border-(--color-danger) bg-(--color-danger) px-4 py-2 text-sm text-(--color-font-danger)">
          {errorMessage}
        </div>
      )}
      <div className="mt-(--padding-sm)">
        <span>Don't have access to this portal?</span>
      </div>
    </div>
  );
};

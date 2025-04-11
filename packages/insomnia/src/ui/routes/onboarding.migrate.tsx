import React from 'react';
import { Button, Heading, Radio, RadioGroup } from 'react-aria-components';
import { type ActionFunction, type LoaderFunction, redirect, useFetcher } from 'react-router-dom';

import { shouldMigrateProjectUnderOrganization } from '../../sync/vcs/migrate-projects-into-organization';
import { invariant } from '../../utils/invariant';
import { Icon } from '../components/icon';
import { InsomniaLogo } from '../components/insomnia-icon';
import { TrailLinesContainer } from '../components/trail-lines-container';

export const loader: LoaderFunction = async () => {
  if (!(await shouldMigrateProjectUnderOrganization())) {
    return redirect('/organization');
  }

  return null;
};

interface MigrationActionData {
  error?: string;
}

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const type = formData.get('type');
  invariant(type === 'local' || type === 'remote', 'Expected type to be either local or remote');

  localStorage.setItem('prefers-project-type', type);

  return redirect('/organization');
};

export const Migrate = () => {
  const { Form, state } = useFetcher<MigrationActionData>();

  return (
    <div className="relative flex h-full w-full bg-[--color-bg] text-left text-base">
      <TrailLinesContainer>
        <div className="flex h-full min-h-[min(450px,90%)] w-[540px] flex-col items-center justify-center">
          <div className="relative flex h-full w-full flex-col items-center justify-center gap-[var(--padding-sm)] rounded-[var(--radius-md)] border border-solid border-[--hl-sm] bg-[--hl-xs] p-[--padding-lg] pt-12">
            <InsomniaLogo className="absolute left-1/2 top-0 h-16 w-16 translate-x-[-50%] translate-y-[-50%] transform" />
            <div className="flex h-full flex-col items-center justify-center pt-2">
              <div className="flex flex-col gap-4 text-[--color-font]">
                <h1 className="text-center text-xl font-bold">Collaboration with Cloud Sync now available</h1>
                <div className="flex flex-col gap-4">
                  <p>
                    With Cloud Sync your projects will be automatically synchronized to the cloud in an encrypted way
                    and available on every Insomnia client after logging in for ease of use and collaboration.
                  </p>
                </div>
                <Form method="POST" className="flex flex-col gap-4 text-left">
                  <RadioGroup
                    aria-label="Project type"
                    name="type"
                    defaultValue={'local'}
                    className="flex flex-col gap-2"
                  >
                    <div className="flex gap-2">
                      <Radio
                        value="local"
                        className="flex-1 rounded border border-solid border-[--hl-md] p-4 transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:outline-none data-[selected]:border-[--color-surprise] data-[disabled]:opacity-25 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise]"
                      >
                        <div className="flex items-center gap-2">
                          <Icon icon="laptop" />
                          <Heading className="text-lg font-bold">Store in Local Vault</Heading>
                        </div>
                        <p className="pt-2">
                          Stored locally only, with no cloud. Ideal when collaboration is not needed.
                        </p>
                      </Radio>
                      <Radio
                        value="remote"
                        className="flex-1 rounded border border-solid border-[--hl-md] p-4 transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:outline-none data-[selected]:border-[--color-surprise] data-[selected]:ring-2 data-[selected]:ring-[--color-surprise]"
                      >
                        <div className="flex items-center gap-2">
                          <Icon icon="globe" />
                          <Heading className="text-lg font-bold">Enable Cloud Sync</Heading>
                        </div>
                        <p className="pt-2">
                          Encrypted and synced securely to the cloud, ideal for out of the box collaboration.
                        </p>
                      </Radio>
                    </div>
                  </RadioGroup>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="submit"
                      isDisabled={state !== 'idle'}
                      className={
                        'rounded-sm bg-[--color-surprise] px-3 py-2 text-sm font-bold text-[--color-font-surprise] transition-colors hover:bg-opacity-90 hover:no-underline' +
                        (state !== 'idle' ? 'animate-pulse cursor-not-allowed' : '')
                      }
                    >
                      Continue
                    </Button>
                  </div>
                </Form>
              </div>
            </div>
          </div>
        </div>
      </TrailLinesContainer>
    </div>
  );
};

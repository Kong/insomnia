import React from 'react';
import { Button, Heading, Radio, RadioGroup } from 'react-aria-components';
import { type ActionFunction, type LoaderFunction, redirect, useFetcher } from 'react-router-dom';

import { shouldMigrateProjectUnderOrganization } from '../../sync/vcs/migrate-projects-into-organization';
import { invariant } from '../../utils/invariant';
import { Icon } from '../components/icon';
import { InsomniaLogo } from '../components/insomnia-icon';
import { TrailLinesContainer } from '../components/trail-lines-container';

export const loader: LoaderFunction = async () => {
  if (!await shouldMigrateProjectUnderOrganization()) {
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
    <div className='relative h-full w-full text-left text-base flex bg-[--color-bg]'>
      <TrailLinesContainer>
        <div
          className='flex justify-center items-center flex-col h-full w-[540px] min-h-[min(450px,90%)]'
        >
          <div
            className='flex flex-col gap-[var(--padding-sm)] items-center justify-center p-[--padding-lg] pt-12 w-full h-full bg-[--hl-xs] rounded-[var(--radius-md)] border-solid border border-[--hl-sm] relative'
          >
            <InsomniaLogo
              className='transform translate-x-[-50%] translate-y-[-50%] absolute top-0 left-1/2 w-16 h-16'
            />
            <div
              className='flex justify-center items-center flex-col h-full pt-2'
            >
              <div className='text-[--color-font] flex flex-col gap-4'>
                <h1 className='text-xl font-bold text-center'>Collaboration with Cloud Sync now available</h1>
                <div className='flex flex-col gap-4'>
                  <p>
                    With Cloud Sync your projects will be automatically synchronized to the cloud in an encrypted way and available on every Insomnia client after logging in for ease of use and collaboration.
                  </p>

                </div>
                <Form method='POST' className='gap-4 flex flex-col text-left'>
                  <RadioGroup aria-label='Project type' name="type" defaultValue={'local'} className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Radio
                        value="local"
                        className="data-[selected]:border-[--color-surprise] flex-1 data-[disabled]:opacity-25 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                      >
                        <div className='flex items-center gap-2'>
                          <Icon icon="laptop" />
                          <Heading className="text-lg font-bold">Store in Local Vault</Heading>
                        </div>
                        <p className="pt-2">
                          Stored locally only, with no cloud. Ideal when collaboration is not needed.
                        </p>
                      </Radio>
                      <Radio
                        value="remote"
                        className="data-[selected]:border-[--color-surprise] flex-1 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                      >
                        <div className='flex items-center gap-2'>

                        <Icon icon="globe" />
                          <Heading className="text-lg font-bold">Enable Cloud Sync</Heading>
                        </div>
                        <p className='pt-2'>
                          Encrypted and synced securely to the cloud, ideal for out of the box collaboration.
                        </p>
                      </Radio>
                    </div>
                  </RadioGroup>
                  <div className='flex justify-end gap-2 items-center'>
                    <Button
                      type="submit"
                      isDisabled={state !== 'idle'}
                      className={'hover:no-underline font-bold bg-[--color-surprise] text-sm hover:bg-opacity-90 py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm' + (state !== 'idle' ? 'animate-pulse cursor-not-allowed' : '')}
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

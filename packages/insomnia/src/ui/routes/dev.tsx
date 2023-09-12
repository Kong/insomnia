import React from 'react';
import { Button, Heading } from 'react-aria-components';
import { ActionFunction, redirect, useFetcher } from 'react-router-dom';

import { settings } from '../../models';
import { invariant } from '../../utils/invariant';
import { InsomniaLogo } from '../components/insomnia-icon';
import { TrailLinesContainer } from '../components/trail-lines-container';
import { useRootLoaderData } from './root';

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const data = Object.fromEntries(formData.entries());

  const userSettings = await settings.get();

  invariant(typeof data.apiURL === 'string', 'Missing apiURL');
  invariant(typeof data.websiteURL === 'string', 'Missing websiteURL');
  invariant(typeof data.aiURL === 'string', 'Missing aiURL');

  await settings.update(userSettings, {
    dev: {
      servers: {
        api: data.apiURL,
        website: data.websiteURL,
        ai: data.aiURL,
      },
    },
  });

  try {
    if (window.localStorage.getItem('hasSeenOnboarding')) {
      return redirect('/organization');
    }
  } catch (e) {
    console.error(e);
  }

  return redirect('/onboarding');
};

const Dev = () => {
  const { settings } = useRootLoaderData();

  const { Form } = useFetcher();

  return (
    <div className="relative text-base text-[--color-font] h-full w-full flex bg-[--color-bg]">
      <TrailLinesContainer>
        <div className="flex justify-center items-center flex-col h-full min-h-[450px]">
          <div className="flex flex-col justify-center pt-[32px] items-center m-0 gap-[--padding-sm] p-[--padding-lg] min-w-[340px] max-w-[400px] rounded-[--radius-md] relative bg-[--hl-sm]">
            <InsomniaLogo
              width={64}
              height={64}
              style={{
                transform: 'translate(-50%, -50%)',
                position: 'absolute',
                top: 0,
                left: '50%',
              }}
            />
            <Heading className='text-2xl py-3'>Insomnia Staging</Heading>
            <p>
              Please enter the API and Website URLs below to get started.
            </p>
            <Form method="POST" className="flex flex-col gap-3 w-full">
              <label className="flex flex-col gap-2">
                <span className="text-[--color-font]">API Url</span>
                <input
                  className="py-3 w-full px-4 rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                  name="apiURL"
                  type="url"
                  required
                  placeholder='https://api.insomnia.rest'
                  defaultValue={settings.dev?.servers.api || ''}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[--color-font]">Website Url</span>
                <input
                  required
                  className="py-3 w-full px-4 rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                  name="websiteURL"
                  type="url"
                  placeholder='https://app.insomnia.rest'
                  defaultValue={settings.dev?.servers.website || ''}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[--color-font]">InsomniaAI Url</span>
                <input
                  required
                  className="py-3 w-full px-4 rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                  name="aiURL"
                  type="url"
                  placeholder='https://ai.insomnia.rest'
                  defaultValue={settings.dev?.servers.ai || ''}
                />
              </label>
              <div className='flex justify-end'>
                <Button type="submit" className="px-4 py-2 bg-[#4000BF] flex items-center justify-center gap-2 aria-pressed:bg-opacity-90 focus:bg-opacity-90 font-semibold rounded-sm text-[--color-font-surprise] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all">
                  Continue
                </Button>
              </div>
            </Form>
          </div>
        </div>
      </TrailLinesContainer>
    </div>
  );
};

export default Dev;

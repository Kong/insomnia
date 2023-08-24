import React from 'react';
import { Button, Heading } from 'react-aria-components';
import { ActionFunction, LoaderFunction, redirect, useFetcher, useLoaderData } from 'react-router-dom';

import { environment } from '../../models';
import { getStagingEnvironmentVariables } from '../../models/environment';
import { invariant } from '../../utils/invariant';
import { InsomniaLogo } from '../components/insomnia-icon';
import { TrailLinesContainer } from '../components/trail-lines-container';

interface LoaderData {
  env: Record<string, string>;
}

export const loader: LoaderFunction = async (): Promise<LoaderData> => {
  const stagingEnv = await getStagingEnvironmentVariables();

  return {
    env: stagingEnv,
  };
};

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const data = Object.fromEntries(formData.entries());

  const stagingEnv = await environment.getOrCreateForParentId('insomnia::staging');

  invariant(data.apiURL, 'Missing apiURL');
  invariant(data.websiteURL, 'Missing websiteURL');

  await environment.update(stagingEnv, {
    data,
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
  const {
    env: { apiURL, websiteURL },
  } = useLoaderData() as LoaderData;

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
                  className="py-2 w-full pl-2 pr-7 rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                  name="apiURL"
                  type="url"
                  required
                  placeholder='https://api.insomnia.rest'
                  defaultValue={apiURL || ''}
                />
              </label>
              <label className="flex flex-col gap-2">
                <span className="text-[--color-font]">Website Url</span>
                <input
                  required
                  className="py-2 w-full pl-2 pr-7 rounded-md border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                  name="websiteURL"
                  type="url"
                  placeholder='https://app.insomnia.rest'
                  defaultValue={websiteURL || ''}
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

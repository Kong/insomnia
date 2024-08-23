import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React, { useEffect } from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';

import { LandingPage } from '../../common/sentry';
import { InsomniaLogo } from '../components/insomnia-icon';
import { TrailLinesContainer } from '../components/trail-lines-container';
import auto_pull from '../images/onboarding/auto_pull.png';
import diff_view from '../images/onboarding/diff_view.png';
import global_search from '../images/onboarding/global_search.png';
import mocks from '../images/onboarding/mocks.png';
import prerequest_scripts from '../images/onboarding/prerequest_scripts.png';
import storage_options from '../images/onboarding/storage_options.png';

const features = [
  {
    id: 'collection_runner',
    icon: 'code',
    title: 'New Collection Runner',
    description:
      'You can run tests for an entire collection using the new Collection Runner! And it\'s unlimited for every Insomnia user.',
    image: prerequest_scripts,
  },
  {
    id: 'test_results',
    icon: 'clone',
    title: 'Test Results',
    description:
      'In the previous v9.x we introduced full scripting support, and now we are introducing the ability to visualize test results when executing a request.',
    image: mocks,
  },
  {
    id: 'invite_control',
    icon: 'database',
    title: 'Invite Control',
    description:
      'With this enterprise capability you can create invite rules to determine what domains can be invited to join an organization.',
    image: storage_options,
  },
  {
    id: 'unpushed_notifications',
    icon: 'file-invoice',
    title: 'Unpushed notifications',
    description: 'You can now see indicators for changes that have not been committed - or have not been pushed - inside your projects and files.',
    image: diff_view,
  },
  {
    id: 'offline_experience',
    icon: 'search',
    title: 'Offline experience',
    description:
      'In the previous Insomnia v9.x we significantly improved the performance of the application, and in this one are making the offline experience even better.',
    image: global_search,
  },
  {
    id: 'multiple_owners',
    icon: 'download',
    title: 'Multiple owners',
    description:
      'With this enterprise feature, we are finally introducing the ability to have multiple co-owners for an enterprise organization account.',
    image: auto_pull,
  },
] satisfies {
  id: string;
  icon: IconName;
  title: string;
  description: string;
  image: string;
}[];

const FeatureWizardView = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ul className="grid grid-cols-3 gap-2 justify-center p-4">
            {features.map(feature => (
              <li key={feature.id}>
                <Link
                  className="w-full hover:bg-[--hl-sm] bg-[--hl-xs] transition-colors select-none h-32 border-solid flex flex-col items-center justify-center border border-[--hl-md] rounded-sm p-4 gap-2 hover:no-underline"
                  to={`/onboarding/${feature.id}`}
                >
                  <i className={`fa fa-${feature.icon} text-xl`} />
                  <span className="text-center text-sm">{feature.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        }
      />
      {[
        features.map((feature, index) => {
          const nextPath =
            index === features.length - 1
              ? ''
              : `/onboarding/${features[index + 1].id}`;
          const prevPath =
            index === 0 ? '' : `/onboarding/${features[index - 1].id}`;

          return (
            <Route
              key={feature.id}
              path={feature.id}
              element={
                <div className="flex text-left flex-col h-80 gap-4 bg-[--color-bg] p-4 relative">
                  <h1 className="flex justify-between text-lg">
                    <span>{feature.title}</span>
                    <span>
                      {index + 1}
                      <span className="text-[--hl-xl]">/{features.length}</span>
                    </span>
                  </h1>
                  <div className="overflow-y-auto max-h-72 flex flex-col items-center gap-3">
                    <p className="text-[--color-font] text-sm">
                      <span>{feature.description}</span>
                    </p>
                    <div className="h-32">
                      <img className="max-h-32 aspect-auto" src={feature.image} />
                    </div>
                    <div className="flex w-full p-4 bottom-0 left-0 sticky justify-between text-sm font-normal bg-gradient-to-t from-[--color-bg] to-[rgba(var(--color-bg-rgb),80%)]">
                      {prevPath ? (
                        <Link className="hover:no-underline" to={prevPath}>
                          <i className="fa fa-arrow-left" /> Previous feature
                        </Link>
                      ) : (
                        <span />
                      )}
                      {nextPath && (
                        <Link className="hover:no-underline" to={nextPath}>
                          Next feature <i className="fa fa-arrow-right" />
                        </Link>
                      )}
                      {!nextPath && (
                        <Link className="hover:no-underline" to="/onboarding">
                          See all <i className="fa fa-arrow-right" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              }
            />
          );
        }),
      ]}
    </Routes>
  );
};

const Onboarding = () => {
  const location = useLocation();

  useEffect(() => {
    window.main.landingPageRendered(LandingPage.Onboarding);
  }, []);

  return (
    <div className="relative h-full w-full text-left flex bg-[--color-bg]">
      <TrailLinesContainer>
        <div className="flex justify-center items-center flex-col h-full w-[600px] min-h-[465px]">
          <div className="flex flex-col gap-[var(--padding-sm)] items-center h-[465px] justify-center p-[--padding-lg] pt-12 w-full bg-[--hl-xs] rounded-[var(--radius-md)] border-solid border border-[--hl-sm] relative">
            <InsomniaLogo className="transform translate-x-[-50%] translate-y-[-50%] absolute top-0 left-1/2 w-16 h-16" />
            <div className="text-[--color-font] flex flex-col gap-6 h-full">
              <h1 className="text-xl text-center">
                🚀 Welcome to Insomnia 10!
              </h1>
              <div>
                <p>
                  We shipped hundreds of improvements including the following notable features:
                </p>
              </div>
              <div className="w-full relative flex-1">
                <FeatureWizardView />
              </div>
              <div className="flex justify-between items-center">
                {location.pathname !== '/onboarding' ? (
                  <Link
                    className="hover:no-underline flex items-center gap-2 text-sm px-4"
                    to="/onboarding"
                  >
                    <i className="fa fa-border-all" />
                    See all features
                  </Link>
                ) : (
                  <span />
                )}
                <Link
                  className="hover:no-underline bg-[--color-surprise] text-sm hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
                  to={window.localStorage.getItem('prefers-project-type') ? '/organization' : '/onboarding/migrate'}
                  onClick={() => window.localStorage.setItem('hasSeenOnboardingV10', 'true')}
                >
                  Continue
                </Link>
              </div>
            </div>
          </div>
        </div>
      </TrailLinesContainer>
    </div>
  );
};

export default Onboarding;

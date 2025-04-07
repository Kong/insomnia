import type { IconName } from '@fortawesome/fontawesome-svg-core';
import React from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';

import { InsomniaLogo } from '../components/insomnia-icon';
import { TrailLinesContainer } from '../components/trail-lines-container';
import git_projects from '../images/onboarding/git_projects.png';
import multiple_tabs from '../images/onboarding/multiple_tabs.png';
import secret_vaults from '../images/onboarding/secret_vaults.png';

const features = [
  {
    id: 'multiple_tabs',
    icon: 'window-restore',
    title: 'Multiple Tabs',
    description:
      'Finally you can work on multiple collections and design documents with the multiple tabs capability that allows you to easily switch between one and another.',
    image: multiple_tabs,
  },
  {
    id: 'git_sync',
    icon: 'git',
    title: 'New Git Sync',
    description:
      'An entirely rebuilt Git Sync experience, where your entire project can be connected to a Git repository and we will import multiple Insomnia resources at once.',
    image: git_projects,
  },
  {
    id: 'secret_vaults',
    icon: 'cloud',
    title: 'Secret Vaults',
    description:
      'With this enterprise capability we now support connecting your secrets with AWS secret Manager, Azure Key Vault, GCP Secret Manager and Hashicorp Vault.',
    image: secret_vaults,
    rounded: true,
  },
] satisfies {
  id: string;
  icon: IconName;
  title: string;
  description: string;
  image: string;
  rounded?: boolean;
}[];

const FeatureWizardView = () => {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ul className="grid grid-cols-1 justify-center gap-2 p-4">
            {features.map(feature => (
              <li key={feature.id}>
                <Link
                  className="flex w-full select-none items-center gap-2 rounded-sm border border-solid border-[--hl-md] bg-[--hl-xs] px-8 py-4 transition-colors hover:bg-[--hl-sm] hover:no-underline"
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
          const nextPath = index === features.length - 1 ? '' : `/onboarding/${features[index + 1].id}`;
          const prevPath = index === 0 ? '' : `/onboarding/${features[index - 1].id}`;

          return (
            <Route
              key={feature.id}
              path={feature.id}
              element={
                <div className="relative flex h-80 flex-col gap-4 bg-[--color-bg] p-4 text-left">
                  <h1 className="flex justify-between text-lg">
                    <span>{feature.title}</span>
                    <span>
                      {index + 1}
                      <span className="text-[--hl-xl]">/{features.length}</span>
                    </span>
                  </h1>
                  <div className="flex max-h-72 flex-col items-center gap-3 overflow-y-auto">
                    <p className="text-sm text-[--color-font]">
                      <span>{feature.description}</span>
                    </p>
                    <div className="h-32">
                      {feature.rounded ? (
                        <img className="aspect-auto max-h-32 rounded-md" src={feature.image} />
                      ) : (
                        <img className="aspect-auto max-h-32" src={feature.image} />
                      )}
                    </div>
                    <div className="sticky bottom-0 left-0 flex w-full justify-between bg-gradient-to-t from-[--color-bg] to-[rgba(var(--color-bg-rgb),80%)] p-4 text-sm font-normal">
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

  return (
    <div className="relative flex h-full w-full bg-[--color-bg] text-left">
      <TrailLinesContainer>
        <div className="flex h-full min-h-[465px] w-[600px] flex-col items-center justify-center">
          <div className="relative flex h-[465px] w-full flex-col items-center justify-center gap-[var(--padding-sm)] rounded-[var(--radius-md)] border border-solid border-[--hl-sm] bg-[--hl-xs] p-[--padding-lg] pt-12">
            <InsomniaLogo className="absolute left-1/2 top-0 h-16 w-16 translate-x-[-50%] translate-y-[-50%] transform" />
            <div className="flex h-full flex-col gap-6 text-[--color-font]">
              <h1 className="text-center text-xl">🚀 Welcome to Insomnia 11!</h1>
              <div>
                <p>We shipped hundreds of improvements including the following notable features:</p>
              </div>
              <div className="relative w-full flex-1">
                <FeatureWizardView />
              </div>
              <div className="flex items-center justify-between">
                {location.pathname !== '/onboarding' ? (
                  <Link className="flex items-center gap-2 px-4 text-sm hover:no-underline" to="/onboarding">
                    <i className="fa fa-border-all" />
                    See all features
                  </Link>
                ) : (
                  <span />
                )}
                <Link
                  className="rounded-sm border border-solid border-[--hl-md] bg-[--color-surprise] px-3 py-2 text-sm text-[--color-font-surprise] transition-colors hover:bg-opacity-90 hover:no-underline"
                  to={window.localStorage.getItem('prefers-project-type') ? '/organization' : '/onboarding/migrate'}
                  onClick={() => window.localStorage.setItem('hasSeenOnboardingV11', 'true')}
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

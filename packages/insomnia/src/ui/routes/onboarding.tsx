import React from 'react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';

import { InsomniaLogo } from '../components/insomnia-icon';
import { TrailLinesContainer } from '../components/trail-lines-container';
import collaborators_rbac from '../images/onboarding/collaborators_rbac.png';
import insomnia_ai from '../images/onboarding/insomnia_ai.png';
import introducing_organizations from '../images/onboarding/introducing_organizations.png';
import new_cloud_dashboard from '../images/onboarding/new_cloud_dashboard.png';
import real_time_collaboration from '../images/onboarding/real_time_collaboration.png';
import sharing_projects from '../images/onboarding/sharing_projects.png';
import social_and_enterprise_sso from '../images/onboarding/social_and_enterprise_sso.png';
import sse_api_support from '../images/onboarding/sse_api_support.png';
import unlimited_projects from '../images/onboarding/unlimited_projects.png';

const features = [
  {
    id: 'sharing_projects',
    icon: 'code-fork',
    title: 'Sharing Projects',
    description:
      'We have entirely reinvented sharing and collaboration in Insomnia. It is now easy and quick to invite as many collaborators as we want to join our projects, collections or design documents.',
    image: sharing_projects,
  },
  {
    id: 'real_time_collaboration',
    icon: 'users',
    title: 'Real time collaboration',
    description:
      'With the new real time collaboration features, you can be more productive, reduce team coordination and always know in real time who is working with you on the same collections or design documents.',
    image: real_time_collaboration,
  },
  {
    id: 'introducing_organizations',
    icon: 'city',
    title: 'Introducing Organizations',
    description:
      'Teams have been replaced with Organizations, you can now create as many as you need and invite people to collaborate with them.',
    image: introducing_organizations,
  },
  {
    id: 'social_and_enterprise_sso',
    icon: 'user-circle',
    title: 'Social and Enterprise SSO',
    description: `Organizations now support EE SSO via SAML and OIDC, while other accounts can login via social SSO providers like Google or GitHub,
    in addition to the traditional email login.`,
    image: social_and_enterprise_sso,
  },
  {
    id: 'sse_api_support',
    icon: 'plug',
    title: 'Server Side Events API Support',
    description:
      'Server Side Events APIs are now supported to give you even more ways to debug APIs with Insomnia, in addition to the previously supported REST, GraphQL, gRPC and WebSockets.',
    image: sse_api_support,
  },
  {
    id: 'insomnia_ai',
    icon: 'robot',
    title: 'Insomnia AI',
    description:
      'With Insomnia Al you can auto-generate API tests based on an OpenAPI specification that you create. Build more reliable APIs and save on development time.',
    image: insomnia_ai,
  },
  {
    id: 'new_cloud_dashboard',
    icon: 'cloud',
    title: 'New cloud dashboard',
    description: 'With an entirely redesigned cloud platform and dashboard at insomnia.rest managing all of your organizations and collaborators is a piece of cake.',
    image: new_cloud_dashboard,
  },
  {
    id: 'collaborators_rbac',
    icon: 'user-friends',
    title: 'Collaborators RBAC',
    description:
      'Inviting users to your personal workspace or organization just got more powerful and intuitive with powerful RBAC rules to determine the level of access.',
    image: collaborators_rbac,
  },
  {
    id: 'unlimited_projects',
    icon: 'infinity',
    title: 'Unlimited Projects',
    description:
      'We removed all limitations to the Insomnia application, you can now create as many projects as you want, with as many files as you want.',
    image: unlimited_projects,
  },
];

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
                  className="w-full hover:bg-[--hl-sm] bg-[--hl-xs] transition-colors select-none h-24 border-solid flex flex-col items-center justify-center text-xs border border-[--hl-md] rounded-sm p-4 gap-2 hover:no-underline"
                  to={`/onboarding/${feature.id}`}
                >
                  <i className={`fa fa-${feature.icon} text-lg`} />
                  <span className="text-center">{feature.title}</span>
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
                <div className="flex text-left flex-col gap-4 bg-[--color-bg] p-4 relative">
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

  return (
    <div className="relative h-full w-full text-left flex bg-[--color-bg]">
      <TrailLinesContainer>
        <div className="flex justify-center items-center flex-col h-full w-[600px] min-h-[450px]">
          <div className="flex flex-col gap-[var(--padding-sm)] items-center justify-center p-[--padding-lg] pt-12 w-full h-full bg-[--hl-xs] rounded-[var(--radius-md)] border-solid border border-[--hl-sm] relative">
            <InsomniaLogo className="transform translate-x-[-50%] translate-y-[-50%] absolute top-0 left-1/2 w-16 h-16" />
            <div className="text-[--color-font] flex flex-col gap-6">
              <h1 className="text-xl text-center">
                🚀 Welcome to Insomnia 8.0!
              </h1>
              <div>
                <p>
                  This new version is the biggest one ever! Notable features
                  are:
                </p>
              </div>
              <div className="w-full relative min-h-full">
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
                  className="hover:no-underline bg-[#4000BF] text-sm hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
                  to="/onboarding/cloud-migration"
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

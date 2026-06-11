import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link, Route, Routes, useLocation } from 'react-router';

import { InsomniaLogo } from '~/ui/components/insomnia-icon';
import { KongLogo } from '~/ui/components/kong-logo';
import { TrailLinesContainer } from '~/ui/components/trail-lines-container';
import custom_linting from '~/ui/images/onboarding/custom_linting.png';
import first_request from '~/ui/images/onboarding/first_request.png';
import konnect_integration from '~/ui/images/onboarding/konnect_integration.png';
import sidebar_navigation from '~/ui/images/onboarding/sidebar_navigation.png';

const features = [
  {
    id: 'navigation_ux',
    icon: <FontAwesomeIcon icon={['fas', 'mouse-pointer']} className="text-xl" />,
    label: 'Updated sidebar navigation',
    title: 'Introducing a simpler way to navigate',
    description: 'The new sidebar experience makes it easier than ever to get to the resources you are working with.',
    image: sidebar_navigation,
  },
  {
    id: 'konnect_integration',
    icon: <KongLogo />,
    label: 'Konnect Integration',
    title: 'Auto-sync your gateway service routes from Konnect',
    description:
      'Get right into testing your gateway configuration in Insomnia with the new Konnect platform integration.',
    image: konnect_integration,
  },
  {
    id: 'first_request_ux',
    icon: <FontAwesomeIcon icon={['fas', 'add']} className="text-xl" />,
    label: 'New Create Request Experience',
    title: 'Need to send a new request? No problem!',
    description:
      'The new project home page provides you with a quick way to configure and send a new request -- all while saving it automatically for when you need it later.',
    image: first_request,
  },
  {
    id: 'custom_linting',
    icon: <FontAwesomeIcon icon={['fas', 'file']} className="text-xl" />,
    label: 'Custom Spec Linting',
    title: 'Upload custom spec linting rules',
    description:
      'Now you can user your own spectral linting rules to help you edit API design files in Insomnia with confidence.',
    image: custom_linting,
  },
] satisfies {
  id: string;
  icon: React.ReactNode;
  label: string;
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
          <ul className="grid grid-cols-2 justify-center gap-2">
            {features.map(feature => (
              <li key={feature.id}>
                <Link
                  className="flex h-34 w-full flex-col items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) bg-(--hl-xs) p-4 transition-colors select-none hover:bg-(--hl-sm) hover:no-underline"
                  to={`/onboarding/${feature.id}`}
                >
                  {feature.icon}
                  <span className="text-center text-sm">{feature.label}</span>
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
                <div className="relative flex flex-col gap-4 bg-(--color-bg) p-4 text-left">
                  <h1 className="flex justify-between text-lg">
                    <span>{feature.title}</span>
                    <span>
                      {index + 1}
                      <span className="text-(--hl-xl)">/{features.length}</span>
                    </span>
                  </h1>
                  <div className="flex flex-1 flex-col items-center gap-3">
                    <p className="text-md text-(--hl)">
                      <span>{feature.description}</span>
                    </p>
                    <div className="flex-1 py-2">
                      <img className="aspect-auto" src={feature.image} />
                    </div>
                    <div className="flex w-full shrink-0 justify-between bg-linear-to-t from-(--color-bg) to-(--color-bg)/80 p-4 text-sm font-normal">
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

const Component = () => {
  const location = useLocation();

  return (
    <div className="relative flex h-full w-full bg-(--color-bg) text-left">
      <TrailLinesContainer>
        <div className="flex h-full min-h-[500px] w-[600px] flex-col items-center justify-center">
          <div className="relative flex h-auto w-full flex-col items-center justify-center gap-(--padding-sm) rounded-md border border-solid border-(--hl-sm) bg-(--hl-xs) p-(--padding-lg) pt-12">
            <InsomniaLogo className="absolute top-0 left-1/2 h-16 w-16 translate-x-[-50%] translate-y-[-50%] transform" />
            <div className="flex h-full flex-col gap-6 text-(--color-font)">
              <div className="flex flex-col gap-4 py-4">
                <h1 className="text-center text-xl">🚀 Welcome to Insomnia 13!</h1>
                <p className="text-center">
                  A faster, more connected API workflow with unified navigation, Konnect gateway sync, and custom API
                  governance support.
                </p>
              </div>
              <div className="relative w-full flex-1">
                <FeatureWizardView />
              </div>
              <div className="flex shrink-0 items-center justify-between">
                {location.pathname !== '/onboarding' && location.pathname !== '/onboarding/' ? (
                  <Link className="flex items-center gap-2 px-4 text-sm hover:no-underline" to="/onboarding">
                    <i className="fa fa-border-all" />
                    See all features
                  </Link>
                ) : (
                  <span />
                )}
                <Link
                  className="rounded-xs border border-solid border-(--hl-md) bg-(--color-surprise) px-3 py-2 text-sm text-(--color-font-surprise) transition-colors hover:bg-(--color-surprise)/90 hover:no-underline"
                  to={window.localStorage.getItem('prefers-project-type') ? '/organization' : '/onboarding/migrate'}
                  onClick={() => window.localStorage.setItem('hasSeenOnboardingV13', 'true')}
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

export default Component;

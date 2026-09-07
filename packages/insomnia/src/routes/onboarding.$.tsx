import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link, Route, Routes, useLocation } from 'react-router';

import { docsPreRequestAndAfterResponseScripts } from '~/common/documentation';
import { InsomniaLogo } from '~/ui/components/insomnia-icon';
import { TrailLinesContainer } from '~/ui/components/trail-lines-container';
import new_api_collection from '~/ui/images/onboarding/new_api_collection.png';
import scripts_for_unit_test from '~/ui/images/onboarding/scripts_for_unit_test.png';

const features = [
  {
    id: 'combine_collections_and_documents',
    icon: <FontAwesomeIcon icon={['fas', 'bars']} className="text-xl" />,
    label: 'Collection and documents combination',
    title: 'New API Collection to combine documents and collections',
    description:
      'For simplicity, we’ve combined documents and collections into API Collections. No functionality has changed - just the UI. You can now access your OpenAPI Specs right from the main API Collection screen.',
    image: new_api_collection,
  },
  {
    id: 'disable_legacy_unit_tests_by_default',
    icon: <FontAwesomeIcon icon={['fas', 'code']} className="text-xl" />,
    label: 'Document Unit Tests Disabled By Default',
    title: 'Legacy documents unit tests functionality is no longer available by default',
    description: (
      <>
        Best practice for both new and existing users continues to be testing via{' '}
        <a href={docsPreRequestAndAfterResponseScripts} className="underline">
          pre request and post-response scripts
        </a>
        . There is a new user setting to enable/disable it. Existing Unit Test users are not affected and we continue to
        support this functionality.
      </>
    ),
    image: scripts_for_unit_test,
  },
] satisfies {
  id: string;
  icon: React.ReactNode;
  label: string;
  title: string;
  description: React.ReactNode;
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
        <div className="flex h-full min-h-125 w-150 flex-col items-center justify-center">
          <div className="relative flex h-auto w-full flex-col items-center justify-center gap-(--padding-sm) rounded-md border border-solid border-(--hl-sm) bg-(--hl-xs) p-(--padding-lg) pt-12">
            <InsomniaLogo className="absolute top-0 left-1/2 h-16 w-16 translate-x-[-50%] translate-y-[-50%] transform" />
            <div className="flex h-full flex-col gap-6 text-(--color-font)">
              <div className="flex flex-col gap-4 py-4">
                <h1 className="text-center text-xl">🚀 Welcome to Insomnia 13.3!</h1>
                <p className="text-center">
                  API Collections now combine Documents and Collections, with OpenAPI Specs accessible directly, while
                  legacy Unit Tests are hidden by default.
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

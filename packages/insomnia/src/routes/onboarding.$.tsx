import type { IconProp } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link, Route, Routes, useLocation } from 'react-router';

import { InsomniaLogo } from '~/ui/components/insomnia-icon';
import { TrailLinesContainer } from '~/ui/components/trail-lines-container';
import generate_mocks from '~/ui/images/onboarding/generate_mocks.png';
import git_for_all from '~/ui/images/onboarding/git_for_all.png';
import mcp_client from '~/ui/images/onboarding/mcp_client.png';
import smart_commits from '~/ui/images/onboarding/smart_commits.png';

const features = [
  {
    id: 'mcp_client',
    icon: ['fac', 'mcp'] as unknown as IconProp,
    title: 'MCP Client',
    description:
      'Test and debug MCP servers with the same workflow you use for APIs including support for oAuth and Dynamic Client Registration.',
    image: mcp_client,
  },
  {
    id: 'auto_generated_mock_servers',
    icon: 'server',
    title: 'Auto-generated mock servers',
    description:
      'Automatically generate a mock server with executable routes from an OpenAPI spec, URL, or chat-based prompt.',
    image: generate_mocks,
  },
  {
    id: 'smart_commits',
    icon: ['fas', 'code-commit'],
    title: 'Smart Commits',
    description:
      'Spend more time coding and less time cleaning up commits. Automatically create commits and comments from your staged changes using AI.',
    image: smart_commits,
  },
  {
    id: 'git_sync_essentials',
    icon: ['fab', 'git-alt'],
    title: 'Git Sync for all plans',
    description:
      'Now Essentials (free)  plan users can get the full benefits of Git Sync projects for up to 3 plan users.',
    image: git_for_all,
  },
] satisfies {
  id: string;
  icon: IconProp;
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
          <ul className="grid grid-cols-2 justify-center gap-2 p-4">
            {features.map(feature => (
              <li key={feature.id}>
                <Link
                  className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) bg-(--hl-xs) p-4 transition-colors select-none hover:bg-(--hl-sm) hover:no-underline"
                  to={`/onboarding/${feature.id}`}
                >
                  <FontAwesomeIcon icon={feature.icon} className="text-xl" />
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
                <div className="relative flex h-96 flex-col gap-4 bg-(--color-bg) p-4 text-left">
                  <h1 className="flex justify-between text-lg">
                    <span>{feature.title}</span>
                    <span>
                      {index + 1}
                      <span className="text-(--hl-xl)">/{features.length}</span>
                    </span>
                  </h1>
                  <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto">
                    <p className="text-sm text-(--color-font)">
                      <span>{feature.description}</span>
                    </p>
                    <div className="h-48 flex-1">
                      <img className="aspect-auto max-h-48" src={feature.image} />
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
          <div className="relative flex h-[500px] w-full flex-col items-center justify-center gap-(--padding-sm) rounded-md border border-solid border-(--hl-sm) bg-(--hl-xs) p-(--padding-lg) pt-12">
            <InsomniaLogo className="absolute top-0 left-1/2 h-16 w-16 translate-x-[-50%] translate-y-[-50%] transform" />
            <div className="flex h-full flex-col gap-6 text-(--color-font)">
              <h1 className="text-center text-xl">🚀 Welcome to Insomnia 12!</h1>
              <div>
                <p>
                  This new version of Insomnia is the biggest one ever! Notable new features that we have shipped are:
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
                  onClick={() => window.localStorage.setItem('hasSeenOnboardingV12', 'true')}
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

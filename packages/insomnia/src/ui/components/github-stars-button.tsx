import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-aria-components';
import * as reactUse from 'react-use';

import { getGitHubRestApiUrl } from '../../common/constants';
import { AnalyticsEvent } from '../analytics';
import { Icon } from './icon';

const LOCALSTORAGE_GITHUB_STARS_KEY = 'insomnia:github-stars';

export const GitHubStarsButton = () => {
  const isMounted = reactUse.useMountedState();
  const localStorageStars = localStorage.getItem(LOCALSTORAGE_GITHUB_STARS_KEY);
  const initialState = Number.parseInt(localStorageStars || '30000', 10);
  const [starCount, setStarCount] = useState(initialState);

  useEffect(() => {
    localStorage.setItem(LOCALSTORAGE_GITHUB_STARS_KEY, String(starCount));
  }, [starCount]);

  const [error, setError] = useState<Error | null>(null);

  reactUse.useMount(() => {
    if (!isMounted()) {
      return;
    }

    fetch(`${getGitHubRestApiUrl()}/repos/Kong/insomnia`)
      .then(data => data.json())
      .then(info => {
        if (!('watchers' in info)) {
          throw new Error('unable to get stars from GitHub API');
        }

        if (!isMounted()) {
          return;
        }

        setStarCount(info.watchers);
        setError(null);
      })
      .catch(error => {
        if (!isMounted()) {
          return;
        }

        console.error('error fetching GitHub stars', error);
        setError(error);
      });
  });

  const starClick = useCallback(() => {
    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.buttonClick,
      properties: {
        type: 'GitHub stars',
        action: 'clicked star',
      },
    });
  }, []);

  const counterClick = useCallback(() => {
    window.main.trackAnalyticsEvent({
      event: AnalyticsEvent.buttonClick,
      properties: {
        type: 'GitHub stars',
        action: 'clicked stargazers',
      },
    });
  }, []);

  const shouldShowCount = !error;

  return (
    <div className="flex divide-x divide-solid divide-(--hl-md) rounded-lg border border-solid border-(--hl-md) select-none">
      <Link onPress={starClick}>
        <a
          href="https://github.com/Kong/insomnia"
          className="flex items-center justify-center gap-2 rounded-l-lg px-4 py-1 text-sm text-(--color-font) ring-transparent outline-hidden transition-all last-of-type:rounded-r-lg hover:bg-(--hl-xs) focus:ring-1 focus:ring-(--hl-md) aria-pressed:bg-(--hl-sm)"
        >
          <Icon icon={['fab', 'github']} />
          Star
        </a>
      </Link>
      {shouldShowCount && (
        <Link onPress={counterClick}>
          <a
            href="https://github.com/Kong/insomnia/stargazers"
            className="flex items-center justify-center gap-2 rounded-r-lg px-4 py-1 text-sm text-(--color-font) ring-transparent outline-hidden transition-all hover:bg-(--hl-xs) focus:ring-1 focus:ring-(--hl-md) aria-pressed:bg-(--hl-sm)"
          >
            {starCount.toLocaleString()}
          </a>
        </Link>
      )}
    </div>
  );
};

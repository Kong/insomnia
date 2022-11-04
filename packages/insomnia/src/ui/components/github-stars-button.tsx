import React, { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useMount, useMountedState } from 'react-use';
import styled from 'styled-components';

import { SegmentEvent, trackSegmentEvent } from '../../common/analytics';
import { selectSettings } from '../redux/selectors';
import { SvgIcon } from './svg-icon';

const Wrapper = styled.div({
  fontSize: 'var(--font-size-xs)',
  zIndex: 0,
  marginLeft: -10,
  display: 'flex',
  height: '16px',
  alignSelf: 'center',
  '& a': {
    textDecoration: 'none !important',
    fontWeight: 'normal !important',
    color: 'var(--hl) !important',
  },
  ':hover': {
    color: 'var(--color-font) !important',
    cursor: 'pointer',
  },
});

const Star = styled.a({
  width: 42,
  justifyContent: 'flex-end',
  backgroundColor: 'var(--hl-xs)',
  padding: '2px',
  alignItems: 'center',
  display: 'flex',
  border: '1px solid var(--hl-sm)',
  color: 'var(--hl) !important',
  ':hover': {
    borderColor: 'var(--hl-xl)',
  },
});

const Icon = styled(SvgIcon)({
  marginRight: 'var(--padding-xxs)',
});

const Counter = styled.a({
  alignItems: 'center',
  paddingLeft: 4,
  paddingRight: 5,
  padding: '0 3px',
  display: 'flex',
  fontVariantNumeric: 'tabular-nums',
  border: '1px solid var(--hl-sm)',
  borderLeft: 'none',
  borderRadius: '0 10px 10px 0',
  ':hover': {
    color: 'var(--color-surprise) !important',
  },
});

const LOCALSTORAGE_GITHUB_STARS_KEY = 'insomnia:github-stars';

export const GitHubStarsButton = () => {
  const isMounted = useMountedState();
  const { incognitoMode } = useSelector(selectSettings);
  const localStorageStars = localStorage.getItem(LOCALSTORAGE_GITHUB_STARS_KEY);
  const initialState = parseInt(localStorageStars || '21700', 10);
  const [starCount, setStarCount] = useState(initialState);

  useEffect(() => {
    localStorage.setItem(LOCALSTORAGE_GITHUB_STARS_KEY, String(starCount));
  }, [starCount]);

  const [error, setError] = useState<Error | null>(null);

  useMount(() => {
    if (incognitoMode) {
      return;
    }

    if (!isMounted()) {
      return;
    }

    fetch('https://api.github.com/repos/Kong/insomnia')
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
    trackSegmentEvent(SegmentEvent.buttonClick, {
      type: 'GitHub stars',
      action: 'clicked star',
    });
  }, []);

  const counterClick = useCallback(() => {
    trackSegmentEvent(SegmentEvent.buttonClick, {
      type: 'GitHub stars',
      action: 'clicked stargazers',
    });
  }, []);

  const shouldShowCount = !Boolean(error) && !incognitoMode;

  return (
    <Wrapper>
      <Star onClick={starClick} href="https://github.com/Kong/insomnia">
        <Icon icon="github" />
        Star
      </Star>

      {shouldShowCount ? (
        <Counter onClick={counterClick} href="https://github.com/Kong/insomnia/stargazers">
          {starCount.toLocaleString()}
        </Counter>
      ) : null}
    </Wrapper>
  );
};

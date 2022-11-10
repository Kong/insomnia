import React, { Fragment, useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useMount, useMountedState } from 'react-use';
import styled from 'styled-components';

import { SegmentEvent, trackSegmentEvent } from '../../common/analytics';
import { selectSettings } from '../redux/selectors';
import { SvgIcon } from './svg-icon';
import { Button } from './themed-button';

const ButtonGroup = styled.div({
  fontSize: 'var(--font-size-xs)',
  display: 'flex',
  border: '1px solid var(--hl)',
  borderRadius: 'var(--radius-md)',
  '&>:first-of-type': {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  '&>:last-of-type': {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
});

const Icon = styled(SvgIcon)({
  marginRight: 'var(--padding-xxs)',
});

const LinkButton = styled(Button).attrs({
  as: 'a',
})({
  '&&': {
    color: 'var(--hl)',
    textDecoration: 'none',
  },
});

const Divider = styled.span({
  height: 'auto',
  borderLeft: '1px solid var(--hl)',
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
    <ButtonGroup>
      <LinkButton size="xs" variant="text" as={'a'} onClick={starClick} href="https://github.com/Kong/insomnia">
        <Icon icon="github" />
        Star
      </LinkButton>

      {shouldShowCount ? (
        <Fragment>
          <Divider />
          <LinkButton size="xs" variant="text" as={'a'} onClick={counterClick} href="https://github.com/Kong/insomnia/stargazers">
            {starCount.toLocaleString()}
          </LinkButton>
        </Fragment>
      ) : null}
    </ButtonGroup>
  );
};

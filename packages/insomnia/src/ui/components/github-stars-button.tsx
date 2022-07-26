import { SvgIcon } from 'insomnia-components';
import React, { useState } from 'react';
import { useMount } from 'react-use';
import styled from 'styled-components';

const Wrapper = styled.div({
  marginLeft: 'var(--padding-md)',
  display: 'flex',
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
  backgroundColor: 'var(--hl-sm)',
  padding: 'var(--padding-xxs)',
  alignItems: 'center',
  height: '100%',
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
  padding: '0 var(--padding-xs)',
  display: 'flex',
  fontVariantNumeric: 'tabular-nums',
  border: '1px solid var(--hl-sm)',
  borderLeft: 'none',
  ':hover': {
    color: 'var(--color-surprise) !important',
  },
});

export const GitHubStarsButton = () => {
  const [starCount, setStarCount] = useState(21700);
  const [error, setError] = useState<Error | null>(null);
  const org = 'Kong';
  const repo = 'insomnia';

  useMount(() => {
    fetch(`https://api.github.com/repos/${org}/${repo}`)
      .then(data => data.json())
      .then(info => {
        if (!('watchers' in info)) {
          throw new Error('unable to get stars from GitHub API');
        }
        setStarCount(info.watchers);
        setError(null);
      })
      .catch(error => {
        console.error('error fetching GitHub stars', error);
        setError(error);
      });
  });

  const shouldShowCount = !Boolean(error);

  return (
    <Wrapper>
      <Star href={`https://github.com/${org}/${repo}`}>
        <Icon icon="github" />
        Star
      </Star>

      {shouldShowCount ? (
        <Counter href={`https://github.com/${org}/${repo}/stargazers`}>
          {starCount.toLocaleString()}
        </Counter>
      ) : null}
    </Wrapper>
  );
};

import { useEffect } from 'react';

import { useGitCredentialsLoaderFetcher } from '~/routes/git-credentials';

export const useGitCredentials = () => {
  const credentialsFetcher = useGitCredentialsLoaderFetcher({ key: 'global-git-credentials' });

  useEffect(() => {
    if (credentialsFetcher.state === 'idle' && !credentialsFetcher.data) {
      credentialsFetcher.load();
    }
  }, [credentialsFetcher]);

  const { credentials = [], providers = [] } = credentialsFetcher.data || {};
  return { credentials, providers };
};

import React, { createContext, FC, PropsWithChildren, useContext, useEffect } from 'react';
import { useFetcher, useFetchers, useParams } from 'react-router-dom';
import { usePrevious } from 'react-use';

import { isLoggedIn } from '../../../account/session';

const AIContext = createContext({
  loading: false,
  generateTests: () => { },
  generateTestsFromSpec: () => { },
  access: {
    enabled: false,
    loading: false,
  },
});

export const AIProvider: FC<PropsWithChildren> = ({ children }) => {
  const {
    organizationId,
    projectId,
    workspaceId,
  } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };

  const aiAccessFetcher = useFetcher();
  const aiGenerateTestsFetcher = useFetcher();
  const aiGenerateTestsFromSpecFetcher = useFetcher();
  const loading = useFetchers().filter(loader => loader.formAction?.includes('/ai/generate/')).some(loader => loader.state !== 'idle');

  const loggedIn = isLoggedIn();

  const prevProjectId = usePrevious(projectId);

  useEffect(() => {
    if (!loggedIn) {
      return;
    }

    const fetcherHasNotRun = aiAccessFetcher.state === 'idle' && !aiAccessFetcher.data;
    const projectIdHasChanged = prevProjectId !== projectId;

    if (fetcherHasNotRun || projectIdHasChanged) {
      aiAccessFetcher.submit({}, {
        method: 'post',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/ai/access`,
      });
    }
  }, [aiAccessFetcher, organizationId, projectId, workspaceId, loggedIn, prevProjectId]);

  const isAIEnabled = aiAccessFetcher.data?.enabled ?? false;

  return (
    <AIContext.Provider
      value={{
        loading,
        generateTests: () => {
          aiGenerateTestsFetcher.submit({}, {
            method: 'post',
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/ai/generate/tests`,
          });
        },
        generateTestsFromSpec: () => {
          aiGenerateTestsFromSpecFetcher.submit({}, {
            method: 'post',
            action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/ai/generate/collection-and-tests`,
          });
        },
        access: {
          enabled: isAIEnabled,
          loading: aiAccessFetcher.state !== 'idle',
        },
      }}
    >
      {children}
    </AIContext.Provider>
  );
};

export const useAIContext = () => useContext(AIContext);

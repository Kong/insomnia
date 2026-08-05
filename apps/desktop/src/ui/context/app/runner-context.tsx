import React, { createContext, type FC, type PropsWithChildren, useCallback, useContext, useEffect } from 'react';
import type { Selection } from 'react-aria-components';

import type { RequestRow } from '~/routes/organization.$organizationId.project.$projectId.workspace.$workspaceId.debug.runner';

import type { UploadDataType } from '../../components/modals/upload-runner-data-modal';
import uiEventBus from '../../event-bus';
import useStateRef from '../../hooks/use-state-ref';

interface RunnerState {
  selectedKeys: Selection;
  iterationCount: number;
  delay: number;
  uploadData: UploadDataType[];
  advancedConfig: Record<string, boolean>;
  file: File | null;
  filePath: string;
  reqList: RequestRow[];
}

type OrgRunnerStateMap = Record<string, Partial<RunnerState>>;

type RunnerStateMap = Record<string, OrgRunnerStateMap>;
interface ContextProps {
  runnerStateMap: RunnerStateMap;
  runnerStateRef?: React.MutableRefObject<RunnerStateMap>;
  updateRunnerState: (organizationId: string, runnerId: string, patch: Partial<RunnerState>) => void;
}
const RunnerContext = createContext<ContextProps>({
  runnerStateMap: {},
  updateRunnerState: () => {},
});

export const RunnerProvider: FC<PropsWithChildren> = ({ children }) => {
  const [runnerState, setRunnerState, runnerStateRef] = useStateRef<RunnerStateMap>({});

  const updateRunnerState = useCallback(
    (organizationId: string, runnerId: string, patch: Partial<RunnerState>) => {
      setRunnerState(prevState => {
        const newState = {
          ...prevState,
          [organizationId]: {
            ...prevState[organizationId],
            [runnerId]: { ...prevState[organizationId]?.[runnerId], ...patch },
          },
        };
        return newState;
      });
    },
    [setRunnerState],
  );

  const handleTabClose = useCallback(
    (organizationId: string, ids: 'all' | string[]) => {
      if (ids === 'all') {
        setRunnerState(prevState => {
          const newState = { ...prevState };
          delete newState[organizationId];
          return newState;
        });
        return;
      }

      setRunnerState(prevState => {
        const newOrgState = { ...prevState?.[organizationId] };
        ids.forEach(id => {
          // runner tab id starts with 'runner' prefix, but the runnerId in this context doesn't have the prefix, so we need to remove it
          if (id.startsWith('runner')) {
            const runnerId = id.replace('runner_', '');
            delete newOrgState[runnerId];
          }
        });
        return {
          ...prevState,
          [organizationId]: newOrgState,
        };
      });
    },
    [setRunnerState],
  );

  useEffect(() => {
    uiEventBus.on('CLOSE_TAB', handleTabClose);
    return () => {
      uiEventBus.off('CLOSE_TAB', handleTabClose);
    };
  }, [handleTabClose]);

  return (
    <RunnerContext.Provider
      value={{
        runnerStateMap: runnerState,
        runnerStateRef,
        updateRunnerState,
      }}
    >
      {children}
    </RunnerContext.Provider>
  );
};

export const useRunnerContext = () => useContext(RunnerContext);

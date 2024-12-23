import React, { createContext, type FC, type PropsWithChildren, useCallback, useContext, useEffect, useState } from 'react';
import type { Selection } from 'react-aria-components';

import type { UploadDataType } from '../../components/modals/upload-runner-data-modal';
import uiEventBus, { UIEventType } from '../../eventBus';
import type { RequestRow } from '../../routes/runner';

interface RunnerState {
  selectedKeys: Selection;
  iterationCount: number;
  delay: number;
  uploadData: UploadDataType[];
  advancedConfig: Record<string, boolean>;
  file: File | null;
  reqList: RequestRow[];
}

type RunnerStateMap = Record<string, Partial<RunnerState> | undefined>;
interface ContextProps {
  runnerStateMap: RunnerStateMap;
  updateRunnerState: (runnerId: string, patch: Partial<RunnerState>) => void;
}
const RunnerContext = createContext<ContextProps>({
  runnerStateMap: {},
  updateRunnerState: () => { },
});

export const RunnerProvider: FC<PropsWithChildren> = ({ children }) => {

  const [runnerState, setRunnerState] = useState<RunnerStateMap>({});

  const updateRunnerState = useCallback((runnerId: string, patch: Partial<RunnerState>) => {
    setRunnerState(prevState => ({
      ...prevState,
      [runnerId]: { ...prevState[runnerId], ...patch },
    }));
  }, []);

  const handleTabClose = useCallback((ids: 'all' | string[]) => {
    if (ids === 'all') {
      setRunnerState({});
      return;
    }

    setRunnerState(prevState => {
      const newState = { ...prevState };
      ids.forEach(id => {
        // runner tab id starts with 'runner' prefix, but the runnerId in this context doesn't have the prefix, so we need to remove it
        if (id.startsWith('runner')) {
          const runnerId = id.replace('runner_', '');
          delete newState[runnerId];
        }
      });
      return newState;
    });
  }, []);

  useEffect(() => {
    uiEventBus.on(UIEventType.CLOSE_TAB, handleTabClose);
    return () => {
      uiEventBus.off(UIEventType.CLOSE_TAB, handleTabClose);
    };
  }, [handleTabClose]);

  return (
    <RunnerContext.Provider
      value={{
        runnerStateMap: runnerState,
        updateRunnerState,
      }}
    >
      {children}
    </RunnerContext.Provider>
  );
};

export const useRunnerContext = () => useContext(RunnerContext);

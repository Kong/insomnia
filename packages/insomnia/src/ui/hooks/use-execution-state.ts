// import { protocol } from 'electron';
import { useEffect, useState } from 'react';

import { getExecution, TimingStep, watchExecution } from '../../network/request-timing';

export function useExecutionState({ requestId }: { requestId: string }) {
  const [steps, setSteps] = useState<TimingStep[]>();

  useEffect(() => {
    let isMounted = true;
    const fn = () => {
      const targetSteps = getExecution(requestId);
      if (targetSteps) {
        isMounted && setSteps(targetSteps);
      }
    };

    fn();

    return () => {
      isMounted = false;
    };
  }, [requestId]);

  useEffect(() => {
    let isMounted = true;

    watchExecution(requestId, (steps: TimingStep[]) => {
      isMounted && setSteps(steps);
    });

    return () => {
      isMounted = false;
    };
  }, [requestId]);

  const isExecuting = () => {
    if (!steps) {
      return false;
    } else if (steps.length === 0) {
      return true;
    }

    const latest = steps[steps.length - 1];
    return latest.duration === undefined;
  };

  return { steps, isExecuting: isExecuting() };
}

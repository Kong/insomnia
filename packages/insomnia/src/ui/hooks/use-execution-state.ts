import { useEffect, useState } from 'react';

import { TimingStep } from '../../main/network/request-timing';

export function useExecutionState({ requestId }: { requestId: string }) {
  const [steps, setSteps] = useState<TimingStep[]>();

  useEffect(() => {
    let isMounted = true;
    const fn = async () => {
      const targetSteps = await window.main.getExecution({ requestId });
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
    // @ts-expect-error -- we use a dynamic channel here
    const unsubscribe = window.main.on(`syncTimers.${requestId}`,
      (_, { executions }: { executions: TimingStep[] }) => {
        isMounted && setSteps(executions);
      });
    return () => {
      isMounted = false;
      unsubscribe();
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

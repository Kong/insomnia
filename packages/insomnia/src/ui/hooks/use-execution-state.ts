import { useEffect, useState } from 'react';

import { TimingStep } from '../../main/network/request-timing';

export function useExecutionState({ requestId }: { requestId?: string }) {
  const [steps, setSteps] = useState<TimingStep[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fn = async () => {
      if (!requestId) {
        return;
      }
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
    const hasSteps = steps && steps.length > 0;
    if (!hasSteps) {
      return false;
    }
    const latest = steps[steps.length - 1];
    return latest.duration === undefined;
  };

  return { steps, isExecuting: isExecuting() };
}

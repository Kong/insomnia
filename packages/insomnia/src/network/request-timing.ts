type StepName = 'Executing pre-request script'
    | 'Rendering request'
    | 'Sending request'
    | 'Executing after-response script';

export interface TimingStep {
    stepName: StepName;
    startedAt: number;
    duration?: number;
}

type TimingCallback = (steps: TimingStep[]) => void;
// this is intentially ephemeral state because we only use breifly while waiting for requests or checking the timings
export const executions = new Map<string, TimingStep[]>();
// only one observer is allowed for simplicity
const executionObservers = new Map<string, TimingCallback>();
export const getExecution = (requestId?: string) => requestId ? executions.get(requestId) : [];
export const startRequestTimingExecution = (requestId: string) => executions.set(requestId, []);
export function addRequestTimingRecord(
    requestId: string,
    record: TimingStep,
) {
    // append to new step to execution
    const execution = [...(executions.get(requestId) || []), record];
    executions.set(requestId, execution);
    executionObservers.get(requestId)?.(execution);
}

export function finishLastRequestTimingRecord(requestId: string) {
    const latest = executions.get(requestId)?.at(-1);
    if (latest) {
        latest.duration = (Date.now() - latest.startedAt);
    }
}

export function watchExecution(requestId: string, cb: TimingCallback) {
    executionObservers.set(requestId, cb);
}

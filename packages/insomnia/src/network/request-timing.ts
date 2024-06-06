type StepName = 'Executing pre-request script' | 'Rendering request' | 'Preparing and sending request' | 'Executing after-response script';

export interface TimingRecord {
    stepName: StepName;
    isDone: boolean;
    startedAt: number;
    endedAt: number;
}

export interface RequestTiming {
    records: TimingRecord[];
    cb?: (records: TimingRecord[]) => void;
}

type TimingCallback = (records: TimingRecord[]) => void;

const requestTimingRecords = new Map<string, TimingRecord[]>();
// only one observer is allowed for simplicity
const requestTimingObservers = new Map<string, TimingCallback>();

export function addRequestTimingRecord(
    executionId: string,
    record: TimingRecord,
) {
    // append to new step to execution
    const execution = [...(requestTimingRecords.get(executionId) || []), record];
    requestTimingRecords.set(executionId, execution);
    requestTimingObservers.get(executionId)?.(execution);
}

export function finishLastRequestTimingRecord(executionId: string) {
    const latest = requestTimingRecords.get(executionId)?.at(-1);
    if (latest) {
        latest.isDone = true;
        latest.endedAt = Date.now();
    }
}

export function deleteRequestTiming(executionId: string) {
    requestTimingRecords.delete(executionId);
    requestTimingObservers.delete(executionId);
}

export function watchRequestTiming(executionId: string, cb: TimingCallback) {
    requestTimingObservers.set(executionId, cb);
}

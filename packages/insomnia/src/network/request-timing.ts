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

export const requestTimingRecords = new Map<string, TimingRecord[]>();
// only one observer is allowed for simplicity
const requestTimingObservers = new Map<string, TimingCallback>();
export const getExecution = (requestId?: string) => requestId ? requestTimingRecords.get(requestId) : [];
export const startRequestTimingExecution = (requestId: string) => requestTimingRecords.set(requestId, []);
export function addRequestTimingRecord(
    requestId: string,
    record: TimingRecord,
) {
    // append to new step to execution
    const execution = [...(requestTimingRecords.get(requestId) || []), record];
    requestTimingRecords.set(requestId, execution);
    requestTimingObservers.get(requestId)?.(execution);
}

export function finishLastRequestTimingRecord(requestId: string) {
    const latest = requestTimingRecords.get(requestId)?.at(-1);
    if (latest) {
        latest.isDone = true;
        latest.endedAt = Date.now();
    }
}

export function watchRequestTiming(requestId: string, cb: TimingCallback) {
    requestTimingObservers.set(requestId, cb);
}

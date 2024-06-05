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
    let existingRecords = requestTimingRecords.get(executionId);
    if (existingRecords) {
        existingRecords.push(record);
    } else {
        existingRecords = [record];
    }

    requestTimingRecords.set(executionId, existingRecords);
    const observer = requestTimingObservers.get(executionId);
    if (observer) {
        observer(existingRecords);
    }
}

export function finishLastRequestTimingRecord(executionId: string) {
    const existingRecords = requestTimingRecords.get(executionId);
    if (!existingRecords || existingRecords.length === 0) {
        return;
    }

    const theLatestRecord = existingRecords[existingRecords.length - 1];
    theLatestRecord.isDone = true;
    theLatestRecord.endedAt = Date.now();
}

export function deleteRequestTiming(executionId: string) {
    requestTimingRecords.delete(executionId);
    requestTimingObservers.delete(executionId);
}

export function watchRequestTiming(executionId: string, cb: TimingCallback) {
    requestTimingObservers.set(executionId, cb);
}

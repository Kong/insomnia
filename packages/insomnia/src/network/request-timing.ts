type StepName = 'Executing pre-request script' | 'Rendering request' | 'Preparing and sending request';

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
    const existingRecords = requestTimingRecords.get(executionId);

    if (existingRecords) {
        if (existingRecords?.length > 0) {
            const theLatestRecord = existingRecords[existingRecords.length - 1];
            theLatestRecord.isDone = true;
            theLatestRecord.endedAt = Date.now();
        }
        existingRecords.push(record);
        requestTimingRecords.set(executionId, existingRecords);

        const observer = requestTimingObservers.get(executionId);
        if (observer) {
            observer(existingRecords);
        }
    } else {
        requestTimingRecords.set(executionId, [record]);

        const observer = requestTimingObservers.get(executionId);
        if (observer) {
            observer([record]);
        }
    }
}

export function endRequestTiming(executionId: string, endedAt: number) {
    const existingRecords = requestTimingRecords.get(executionId);

    if (existingRecords && existingRecords.length > 0) {
        const theLatestRecord = existingRecords[existingRecords.length - 1];
        theLatestRecord.endedAt = endedAt;

        const observer = requestTimingObservers.get(executionId);
        if (observer) {
            observer(existingRecords);
        }
    }
}

export function deleteRequestTiming(executionId: string) {
    requestTimingRecords.delete(executionId);
    requestTimingObservers.delete(executionId);
}

export function watchRequestTiming(executionId: string, cb: TimingCallback) {
    requestTimingObservers.set(executionId, cb);
}

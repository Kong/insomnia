import { BrowserWindow } from 'electron';

type StepName = 'Executing pre-request script'
    | 'Rendering request'
    | 'Sending request'
    | 'Executing after-response script';

export interface TimingStep {
    stepName: StepName;
    startedAt: number;
    duration?: number;
}

export const executions = new Map<string, TimingStep[]>();
export const getExecution = (requestId?: string) => requestId ? executions.get(requestId) : [];
export const startRequestTimingExecution = (requestId: string) => executions.set(requestId, []);
export function addRequestTimingRecord(
    requestId: string,
    record: TimingStep,
) {
    // append to new step to execution
    const execution = [...(executions.get(requestId) || []), record];
    executions.set(requestId, execution);
    for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(`syncTimers.${requestId}`, { executions: executions.get(requestId) });
    }
}

export function finishLastRequestTimingRecord(requestId: string) {
    const latest = executions.get(requestId)?.at(-1);
    if (latest) {
        latest.duration = (Date.now() - latest.startedAt);
    }
    for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(`syncTimers.${requestId}`, { executions: executions.get(requestId) });
    }
}

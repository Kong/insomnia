import { BrowserWindow } from 'electron';

export interface TimingStep {
    stepName: string;
    startedAt: number;
    duration?: number;
}
export const executions = new Map<string, TimingStep[]>();

export const getExecution = (requestId?: string) => requestId ? executions.get(requestId) : [];

export const startExecution = (requestId: string) => executions.set(requestId, []);

export function addExecutionStep(
    requestId: string,
    stepName: string,
) {
    // append to new step to execution
    const record: TimingStep = {
        stepName,
        startedAt: Date.now(),
    };
    const execution = [...(executions.get(requestId) || []), record];
    executions.set(requestId, execution);
    for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(`syncTimers.${requestId}`, { executions: executions.get(requestId) });
    }
}

export function completeExecutionStep(requestId: string) {
    const latest = executions.get(requestId)?.at(-1);
    if (latest) {
        latest.duration = (Date.now() - latest.startedAt);
    }
    for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(`syncTimers.${requestId}`, { executions: executions.get(requestId) });
    }
}

export function updateLatestStepName(
    executionId: string,
    stepName: string,
) {
    const steps = executions.get(executionId) || [];
    if (steps.length > 0) {
        const latestStep = steps[steps.length - 1];
        latestStep.stepName = stepName;
        executions.set(executionId, steps);
    }

    for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(`syncTimers.${executionId}`, { executions: executions.get(executionId) });
    }
}

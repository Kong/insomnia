import { describe, expect, it } from 'vitest';

import { createActionGate } from './action-gate';

// An action that runs until `finish` is called.
function deferredAction(log: string[], name: string) {
  let finish!: () => void;
  const done = new Promise<void>(resolve => {
    finish = resolve;
  });
  const perform = async () => {
    log.push(`${name} started`);
    await done;
    log.push(`${name} finished`);
  };
  return { perform, finish };
}

const flush = () => new Promise(resolve => setTimeout(resolve));

describe('createActionGate', () => {
  it('skips an action tried while another is in flight, even within the same tick', async () => {
    const log: string[] = [];
    const gate = createActionGate(() => {});
    const first = deferredAction(log, 'first');
    const second = deferredAction(log, 'second');

    const running = gate.tryRun(first.perform);
    expect(gate.tryRun(second.perform)).toBeUndefined();
    first.finish();
    await running;

    expect(log).toEqual(['first started', 'first finished']);
  });

  it('runs an action that waits for the one in flight right after it, rather than dropping it', async () => {
    const log: string[] = [];
    const gate = createActionGate(() => {});
    const entityStage = deferredAction(log, 'entity stage');
    const fileStage = deferredAction(log, 'file stage');

    const entity = gate.tryRun(entityStage.perform);
    const file = gate.runAfter(fileStage.perform);
    await flush();
    expect(log).toEqual(['entity stage started']);

    entityStage.finish();
    await entity;
    await flush();
    fileStage.finish();
    await file;

    expect(log).toEqual(['entity stage started', 'entity stage finished', 'file stage started', 'file stage finished']);
  });

  it('runs waiting actions one at a time and reports when an action is in flight', async () => {
    const changes: boolean[] = [];
    const log: string[] = [];
    const gate = createActionGate(isInFlight => changes.push(isInFlight));
    const first = deferredAction(log, 'first');
    const second = deferredAction(log, 'second');
    const third = deferredAction(log, 'third');

    const runs = [gate.tryRun(first.perform), gate.runAfter(second.perform), gate.runAfter(third.perform)];
    first.finish();
    await flush();
    expect(log).toEqual(['first started', 'first finished', 'second started']);
    second.finish();
    await flush();
    third.finish();
    await Promise.all(runs);

    expect(log.filter(entry => entry.endsWith('started'))).toEqual([
      'first started',
      'second started',
      'third started',
    ]);
    expect(changes).toEqual([true, false, true, false, true, false]);
  });

  it('frees the gate when an action fails', async () => {
    const gate = createActionGate(() => {});

    await expect(gate.tryRun(() => Promise.reject(new Error('git failed')))).rejects.toThrow('git failed');

    expect(await gate.tryRun(async () => 'next')).toBe('next');
  });
});

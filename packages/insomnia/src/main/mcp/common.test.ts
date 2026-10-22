import { describe, expect, it } from 'vitest';

import { CONFIDENTIAL_MASK_VALUE } from '~/common/templating/confidential-value-policy';

import { type ConnectionContext, writeEventLogAndNotify, writeTimeline } from './common';

const makeContext = (sensitiveValues: string[]) => {
  const timelineWrites: string[] = [];
  const eventLogWrites: string[] = [];
  const context = {
    requestId: 'req_mcp',
    // an empty responseId short-circuits the renderer notification inside the write callback
    responseId: '',
    pendingEventIds: [],
    sensitiveValues: new Set(sensitiveValues),
    timelineStream: { closed: false, write: (chunk: string) => timelineWrites.push(chunk) },
    eventLogStream: { writableEnded: false, write: (chunk: string) => eventLogWrites.push(chunk) },
  } as unknown as ConnectionContext;

  return { context, timelineWrites, eventLogWrites };
};

describe('MCP timeline and event-log redaction', () => {
  it('redacts the timeline value before serializing it', () => {
    const { context, timelineWrites } = makeContext(['s3cr3t']);

    writeTimeline(context, { value: 'With env: TOKEN=s3cr3t', name: 'Text', timestamp: 1 });

    expect(JSON.parse(timelineWrites[0])).toEqual({
      value: `With env: TOKEN=${CONFIDENTIAL_MASK_VALUE}`,
      name: 'Text',
      timestamp: 1,
    });
  });

  it('redacts nested event-log payloads before serializing, so values needing JSON escaping still match', () => {
    const secret = 'p@ss"with\\slash';
    const { context, eventLogWrites } = makeContext([secret]);

    writeEventLogAndNotify(context, {
      type: 'message',
      direction: 'OUTGOING',
      method: 'tools/call',
      data: { params: { arguments: { token: secret } } },
    });

    expect(JSON.parse(eventLogWrites[0]).data.params.arguments.token).toBe(CONFIDENTIAL_MASK_VALUE);
    expect(eventLogWrites[0]).not.toContain('p@ss');
  });

  it('leaves both streams untouched when nothing was collected (setting off)', () => {
    const { context, timelineWrites, eventLogWrites } = makeContext([]);

    writeTimeline(context, { value: 'TOKEN=s3cr3t', name: 'Text', timestamp: 1 });
    writeEventLogAndNotify(context, {
      type: 'message',
      direction: 'OUTGOING',
      method: 'tools/call',
      data: { token: 's3cr3t' },
    });

    expect(timelineWrites[0]).toContain('s3cr3t');
    expect(eventLogWrites[0]).toContain('s3cr3t');
  });
});

import { describe, expect, it } from 'vitest';

import { CONFIDENTIAL_MASK_VALUE } from '~/common/templating/confidential-value-policy';

import { createSensitiveValuesRegistry } from './sensitive-values-registry';

const REQUEST_ID = 'req_1';
const OTHER_REQUEST_ID = 'req_2';
// What the renderer sends when the hide-secrets setting is off.
const NO_VALUES = undefined;

describe('register', () => {
  it('merges values across calls for the same request', () => {
    const registry = createSensitiveValuesRegistry();
    registry.register(REQUEST_ID, ['first']);
    registry.register(REQUEST_ID, ['second']);

    expect(registry.redactText(REQUEST_ID, 'first and second')).toBe(
      `${CONFIDENTIAL_MASK_VALUE} and ${CONFIDENTIAL_MASK_VALUE}`,
    );
  });

  it('ignores undefined and empty value lists', () => {
    const registry = createSensitiveValuesRegistry();
    registry.register(REQUEST_ID, NO_VALUES);
    registry.register(REQUEST_ID, []);

    expect(registry.getValues(REQUEST_ID)).toEqual([]);
  });

  it('skips empty strings, which would otherwise match everywhere', () => {
    const registry = createSensitiveValuesRegistry();
    registry.register(REQUEST_ID, ['', 'secret']);

    expect(registry.getValues(REQUEST_ID)).toEqual(['secret']);
  });

  it('keeps requests isolated from each other', () => {
    const registry = createSensitiveValuesRegistry();
    registry.register(REQUEST_ID, ['secret']);

    expect(registry.redactText(OTHER_REQUEST_ID, 'secret')).toBe('secret');
  });
});

describe('reset', () => {
  // A connect that never reached its cleanup leaves its values behind, so a new connection has
  // to start from a fresh set rather than merge into the stale one.
  it('drops values left behind by a previous connection', () => {
    const registry = createSensitiveValuesRegistry();
    registry.register(REQUEST_ID, ['stale']);
    registry.reset(REQUEST_ID, ['fresh']);

    expect(registry.redactText(REQUEST_ID, 'stale and fresh')).toBe(`stale and ${CONFIDENTIAL_MASK_VALUE}`);
  });

  // The renderer sends nothing once the setting is off, which has to empty the set rather than
  // leave the previous connection's values in place.
  it('empties the set when the renderer sends no values', () => {
    const registry = createSensitiveValuesRegistry();
    registry.register(REQUEST_ID, ['stale']);
    registry.reset(REQUEST_ID, NO_VALUES);

    expect(registry.getValues(REQUEST_ID)).toEqual([]);
    expect(registry.redactText(REQUEST_ID, 'stale')).toBe('stale');
  });
});

describe('redactText', () => {
  it('returns the text unchanged when nothing is registered', () => {
    const registry = createSensitiveValuesRegistry();

    expect(registry.redactText(REQUEST_ID, 'wss://example.com?token=abc')).toBe('wss://example.com?token=abc');
  });

  it('masks every occurrence of a registered value', () => {
    const registry = createSensitiveValuesRegistry();
    registry.register(REQUEST_ID, ['abc']);

    expect(registry.redactText(REQUEST_ID, 'token=abc, again abc')).toBe(
      `token=${CONFIDENTIAL_MASK_VALUE}, again ${CONFIDENTIAL_MASK_VALUE}`,
    );
  });
});

describe('redactEvent', () => {
  it('returns the event untouched when nothing is registered', () => {
    const registry = createSensitiveValuesRegistry();
    const event = { type: 'message', data: 'secret' };

    expect(registry.redactEvent(REQUEST_ID, event)).toBe(event);
  });

  it('redacts string leaves nested in the event', () => {
    const registry = createSensitiveValuesRegistry();
    registry.register(REQUEST_ID, ['secret']);

    expect(registry.redactEvent(REQUEST_ID, { type: 'message', meta: { headers: ['auth: secret'] } })).toEqual({
      type: 'message',
      meta: { headers: [`auth: ${CONFIDENTIAL_MASK_VALUE}`] },
    });
  });
});

describe('getValues', () => {
  it('returns an empty array for an unknown request', () => {
    const registry = createSensitiveValuesRegistry();

    expect(registry.getValues(REQUEST_ID)).toEqual([]);
  });

  it('returns a copy, so callers cannot mutate the registered set', () => {
    const registry = createSensitiveValuesRegistry();
    registry.register(REQUEST_ID, ['secret']);

    registry.getValues(REQUEST_ID).push('injected');

    expect(registry.getValues(REQUEST_ID)).toEqual(['secret']);
  });
});

describe('clear', () => {
  it('stops redacting for that request only', () => {
    const registry = createSensitiveValuesRegistry();
    registry.register(REQUEST_ID, ['secret']);
    registry.register(OTHER_REQUEST_ID, ['secret']);

    registry.clear(REQUEST_ID);

    expect(registry.redactText(REQUEST_ID, 'secret')).toBe('secret');
    expect(registry.redactText(OTHER_REQUEST_ID, 'secret')).toBe(CONFIDENTIAL_MASK_VALUE);
  });
});

describe('createSensitiveValuesRegistry', () => {
  // Each protocol (WebSocket / Socket.IO / curl) holds its own instance.
  it('keeps instances independent', () => {
    const registryA = createSensitiveValuesRegistry();
    const registryB = createSensitiveValuesRegistry();

    registryA.register(REQUEST_ID, ['secret']);

    expect(registryB.redactText(REQUEST_ID, 'secret')).toBe('secret');
  });
});

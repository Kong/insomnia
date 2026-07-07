import { describe, expect, it, vi } from 'vitest';

import { ALLOWED_PERMISSIONS, isPermissionAllowed, registerPermissionHandlers } from './session-security';

describe('session permission posture', () => {
  it('allows only clipboard write', () => {
    expect([...ALLOWED_PERMISSIONS]).toEqual(['clipboard-sanitized-write']);
  });

  it('allows clipboard-sanitized-write', () => {
    expect(isPermissionAllowed('clipboard-sanitized-write')).toBe(true);
  });

  it.each([
    'clipboard-read',
    'media',
    'geolocation',
    'notifications',
    'midi',
    'midiSysex',
    'pointerLock',
    'fullscreen',
    'openExternal',
    'unknown',
  ])('denies %s', permission => {
    expect(isPermissionAllowed(permission)).toBe(false);
  });

  it('wires deny-by-default handlers onto the session', () => {
    const fakeSession = {
      setPermissionRequestHandler: vi.fn(),
      setPermissionCheckHandler: vi.fn(),
    } as any;

    registerPermissionHandlers(fakeSession);

    const requestHandler = fakeSession.setPermissionRequestHandler.mock.calls[0][0];
    const checkHandler = fakeSession.setPermissionCheckHandler.mock.calls[0][0];

    const grant = vi.fn();
    requestHandler(null, 'clipboard-sanitized-write', grant);
    expect(grant).toHaveBeenCalledWith(true);

    const deny = vi.fn();
    requestHandler(null, 'clipboard-read', deny);
    expect(deny).toHaveBeenCalledWith(false);

    expect(checkHandler(null, 'clipboard-sanitized-write')).toBe(true);
    expect(checkHandler(null, 'media')).toBe(false);
  });
});

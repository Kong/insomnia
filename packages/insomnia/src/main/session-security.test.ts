import { describe, expect, it, vi } from 'vitest';

import { ALLOWED_PERMISSIONS, isPermissionAllowed, registerPermissionHandlers } from './session-security';

describe('session permission posture', () => {
  it('allows only clipboard permissions', () => {
    expect([...ALLOWED_PERMISSIONS]).toEqual(['clipboard-read', 'clipboard-sanitized-write']);
  });

  it.each(['clipboard-read', 'clipboard-sanitized-write'])('allows %s', permission => {
    expect(isPermissionAllowed(permission)).toBe(true);
  });

  it.each([
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
    requestHandler(null, 'clipboard-read', grant);
    expect(grant).toHaveBeenCalledWith(true);

    const deny = vi.fn();
    requestHandler(null, 'geolocation', deny);
    expect(deny).toHaveBeenCalledWith(false);

    expect(checkHandler(null, 'clipboard-sanitized-write')).toBe(true);
    expect(checkHandler(null, 'media')).toBe(false);
  });
});

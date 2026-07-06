import type { Settings } from 'insomnia-data';
import { keyboardKeys, newDefaultRegistry } from 'insomnia-data/common';
import { describe, expect, it } from 'vitest';

import { migrate } from './settings';

const { sidebar_showCreateDropdown: _, ...legacyRegistry } = newDefaultRegistry();
const legacyHotKeyRegistryBeforeV13 = {
  ...legacyRegistry,
  request_createHTTP: {
    macKeys: [
      { meta: true, keyCode: keyboardKeys.n.keyCode },
      { alt: true, meta: true, keyCode: keyboardKeys.n.keyCode },
    ],
    winLinuxKeys: [
      { ctrl: true, keyCode: keyboardKeys.n.keyCode },
      { ctrl: true, alt: true, keyCode: keyboardKeys.n.keyCode },
    ],
  },
};

function makeSettings(overrides: Partial<Settings['hotKeyRegistry']> = {}): Settings {
  return {
    hotKeyRegistry: { ...newDefaultRegistry(), ...overrides },
  } as Settings;
}

function makeSettingsWithLegacyHotKeyRegistry(overrides: Partial<Settings['hotKeyRegistry']> = {}): Settings {
  return {
    hotKeyRegistry: { ...legacyHotKeyRegistryBeforeV13, ...overrides },
  } as Settings;
}

describe('migrateCreateHTTPHotKey()', () => {
  it('uses new default hotkeys when hotkeys have not been modified', () => {
    const legacySettings = makeSettingsWithLegacyHotKeyRegistry();
    const result = migrate(legacySettings);

    expect(result.hotKeyRegistry.request_createHTTP.macKeys).toEqual([
      { meta: true, alt: true, keyCode: keyboardKeys.n.keyCode },
    ]);
    expect(result.hotKeyRegistry.request_createHTTP.winLinuxKeys).toEqual([
      { ctrl: true, alt: true, keyCode: keyboardKeys.n.keyCode },
    ]);
    expect(result.hotKeyRegistry.sidebar_showCreateDropdown.macKeys).toEqual([
      { meta: true, keyCode: keyboardKeys.n.keyCode },
    ]);
    expect(result.hotKeyRegistry.sidebar_showCreateDropdown.winLinuxKeys).toEqual([
      { ctrl: true, keyCode: keyboardKeys.n.keyCode },
    ]);
  });

  it('does not change request_createHTTP when customized to a key without the conflict', () => {
    const customKey = {
      macKeys: [{ meta: true, shift: true, keyCode: keyboardKeys.h.keyCode }],
      winLinuxKeys: [{ ctrl: true, shift: true, keyCode: keyboardKeys.h.keyCode }],
    };

    const legacySettings = makeSettingsWithLegacyHotKeyRegistry({
      request_createHTTP: customKey,
    });
    const result = migrate(legacySettings);

    expect(result.hotKeyRegistry.request_createHTTP.macKeys).toEqual(customKey.macKeys);
    expect(result.hotKeyRegistry.request_createHTTP.winLinuxKeys).toEqual(customKey.winLinuxKeys);
    expect(result.hotKeyRegistry.sidebar_showCreateDropdown.macKeys).toEqual([
      { meta: true, keyCode: keyboardKeys.n.keyCode },
    ]);
    expect(result.hotKeyRegistry.sidebar_showCreateDropdown.winLinuxKeys).toEqual([
      { ctrl: true, keyCode: keyboardKeys.n.keyCode },
    ]);
  });

  it('removes only the conflicting Cmd/Ctrl+N when request_createHTTP has multiple bindings including it', () => {
    const conflictingMac = { meta: true, keyCode: keyboardKeys.n.keyCode };
    const conflictingWin = { ctrl: true, keyCode: keyboardKeys.n.keyCode };
    const extraMac = { meta: true, shift: true, keyCode: keyboardKeys.h.keyCode };
    const extraWin = { ctrl: true, shift: true, keyCode: keyboardKeys.h.keyCode };

    const settings = makeSettingsWithLegacyHotKeyRegistry({
      request_createHTTP: {
        macKeys: [conflictingMac, extraMac],
        winLinuxKeys: [conflictingWin, extraWin],
      },
    });
    const result = migrate(settings);

    expect(result.hotKeyRegistry.request_createHTTP.macKeys).toEqual([extraMac]);
    expect(result.hotKeyRegistry.request_createHTTP.winLinuxKeys).toEqual([extraWin]);
  });

  it('does not change request_create HTTP hotkey when the new version user sets it to a non-conflicting key', () => {
    const customMac = { meta: true, keyCode: keyboardKeys.t.keyCode };
    const customWin = { ctrl: true, keyCode: keyboardKeys.t.keyCode };
    const settings = makeSettings({
      request_createHTTP: {
        macKeys: [customMac],
        winLinuxKeys: [customWin],
      },
    });
    const result = migrate(settings);

    expect(result.hotKeyRegistry.request_createHTTP.macKeys).toEqual([customMac]);
    expect(result.hotKeyRegistry.request_createHTTP.winLinuxKeys).toEqual([customWin]);
  });

  it('does not change request_createHTTP when it includes Cmd/Ctrl+N but sidebar_showCreateDropdown was changed away from Cmd/Ctrl+N', () => {
    const conflictingMac = { meta: true, keyCode: keyboardKeys.n.keyCode };
    const conflictingWin = { ctrl: true, keyCode: keyboardKeys.n.keyCode };
    const customSidebarMac = { meta: true, keyCode: keyboardKeys.j.keyCode };
    const customSidebarWin = { ctrl: true, keyCode: keyboardKeys.j.keyCode };

    const settings = makeSettings({
      request_createHTTP: {
        macKeys: [conflictingMac],
        winLinuxKeys: [conflictingWin],
      },
      sidebar_showCreateDropdown: {
        macKeys: [customSidebarMac],
        winLinuxKeys: [customSidebarWin],
      },
    });
    const result = migrate(settings);

    expect(result.hotKeyRegistry.request_createHTTP.macKeys).toEqual([conflictingMac]);
    expect(result.hotKeyRegistry.request_createHTTP.winLinuxKeys).toEqual([conflictingWin]);
    expect(result.hotKeyRegistry.sidebar_showCreateDropdown.macKeys).toEqual([customSidebarMac]);
    expect(result.hotKeyRegistry.sidebar_showCreateDropdown.winLinuxKeys).toEqual([customSidebarWin]);
  });

  it('resets request_createHTTP to new default when its only binding is the conflicting Cmd/Ctrl+N', () => {
    const settings = makeSettingsWithLegacyHotKeyRegistry({
      request_createHTTP: {
        macKeys: [{ meta: true, keyCode: keyboardKeys.n.keyCode }],
        winLinuxKeys: [{ ctrl: true, keyCode: keyboardKeys.n.keyCode }],
      },
    });
    const result = migrate(settings);

    expect(result.hotKeyRegistry.request_createHTTP.macKeys).toEqual(newDefaultRegistry().request_createHTTP.macKeys);
    expect(result.hotKeyRegistry.request_createHTTP.winLinuxKeys).toEqual(
      newDefaultRegistry().request_createHTTP.winLinuxKeys,
    );
  });
});

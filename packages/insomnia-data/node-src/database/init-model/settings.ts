import type { Settings } from 'insomnia-data';
import type { KeyboardShortcut, KeyCombination } from 'insomnia-data/common';
import { areSameKeyCombinations, keyboardKeys, newDefaultRegistry } from 'insomnia-data/common';

export function migrate(doc: Settings) {
  try {
    doc = migrateEnsureHotKeys(doc);
    doc = migrateCreateHTTPHotKey(doc);
    return doc;
  } catch (e) {
    console.log('[db] Error during settings migration', e);
    throw e;
  }
}

/**
 * Ensure map is updated when new hotkeys are added
 */
function migrateEnsureHotKeys(settings: Settings): Settings {
  const defaultHotKeyRegistry = newDefaultRegistry();

  // Remove any hotkeys that are no longer in the default registry
  const hotKeyRegistry = (Object.keys(settings.hotKeyRegistry) as KeyboardShortcut[]).reduce(
    (newHotKeyRegistry, key) => {
      if (key in defaultHotKeyRegistry) {
        newHotKeyRegistry[key] = settings.hotKeyRegistry[key];
      }

      return newHotKeyRegistry;
    },
    {} as Settings['hotKeyRegistry'],
  );

  settings.hotKeyRegistry = { ...defaultHotKeyRegistry, ...hotKeyRegistry };
  return settings;
}

/**
 * `request_createHTTP` used to be bound to Cmd/Ctrl+N by default, but that combination is now used for open create dropdown on sidebar.
 *  If the user's binding still contains Cmd/Ctrl+N reset it to the current default.
 *  If the user has customized it to something that does not use Cmd/Ctrl+N, leave their customization untouched.
 */
function migrateCreateHTTPHotKey(settings: Settings): Settings {
  const createRequestHotKey = settings.hotKeyRegistry?.request_createHTTP;
  const sidebarCreateDropdownHotKey = settings.hotKeyRegistry?.sidebar_showCreateDropdown;
  const defaultHotKeyRegistry = newDefaultRegistry();

  if (!createRequestHotKey) {
    return settings;
  }

  const defaultSidebarCreateDropdownMacKey = defaultHotKeyRegistry.sidebar_showCreateDropdown.macKeys[0];
  const defaultSidebarCreateDropdownWindowsKey = defaultHotKeyRegistry.sidebar_showCreateDropdown.winLinuxKeys[0];

  // Check if the user's binding for `request_createHTTP` conflicts with the default binding for `sidebar_showCreateDropdown`
  const hasConflictOnMac =
    createRequestHotKey.macKeys.some(comb => areSameKeyCombinations(comb, defaultSidebarCreateDropdownMacKey)) &&
    sidebarCreateDropdownHotKey.macKeys.some(comb => areSameKeyCombinations(comb, defaultSidebarCreateDropdownMacKey));
  const hasConflictOnWindows =
    createRequestHotKey.winLinuxKeys.some(comb =>
      areSameKeyCombinations(comb, defaultSidebarCreateDropdownWindowsKey),
    ) &&
    sidebarCreateDropdownHotKey.winLinuxKeys.some(comb =>
      areSameKeyCombinations(comb, defaultSidebarCreateDropdownWindowsKey),
    );

  if (hasConflictOnMac) {
    // Filter out the conflicting hotkey and reset to default if no other hotkeys remain
    const filtered = createRequestHotKey.macKeys.filter(
      comb => !areSameKeyCombinations(comb, defaultSidebarCreateDropdownMacKey),
    );
    settings.hotKeyRegistry.request_createHTTP.macKeys =
      filtered.length > 0 ? filtered : newDefaultRegistry().request_createHTTP.macKeys;
  }
  if (hasConflictOnWindows) {
    // Filter out the conflicting hotkey and reset to default if no other hotkeys remain
    const filtered = createRequestHotKey.winLinuxKeys.filter(
      comb => !areSameKeyCombinations(comb, defaultSidebarCreateDropdownWindowsKey),
    );
    settings.hotKeyRegistry.request_createHTTP.winLinuxKeys =
      filtered.length > 0 ? filtered : newDefaultRegistry().request_createHTTP.winLinuxKeys;
  }

  return settings;
}

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
  const current = settings.hotKeyRegistry?.request_createHTTP;

  if (!current) {
    return settings;
  }

  // Cmd/Ctrl + N is now used for open create dropdown on sidebar
  const conflictShortCuts: { mac: KeyCombination; windows: KeyCombination } = {
    mac: { meta: true, keyCode: keyboardKeys.n.keyCode },
    windows: { ctrl: true, keyCode: keyboardKeys.n.keyCode },
  };

  const hasConflict =
    current.macKeys.some(comb => areSameKeyCombinations(comb, conflictShortCuts.mac)) ||
    current.winLinuxKeys.some(comb => areSameKeyCombinations(comb, conflictShortCuts.windows));

  if (hasConflict) {
    settings.hotKeyRegistry.request_createHTTP = newDefaultRegistry().request_createHTTP;
  }

  return settings;
}

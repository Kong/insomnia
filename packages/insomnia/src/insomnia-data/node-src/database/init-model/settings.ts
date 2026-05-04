import * as hotkeys from '~/common/hotkeys';
import type { KeyboardShortcut } from '~/common/settings';
import type { Settings } from '~/insomnia-data';

export function migrate(doc: Settings) {
  try {
    doc = migrateEnsureHotKeys(doc);
    doc = migrateEnsureScriptingDefaults(doc);
    return doc;
  } catch (e) {
    console.log('[db] Error during settings migration', e);
    throw e;
  }
}

/**
 * Ensure new scripting settings fields exist with proper defaults
 */
function migrateEnsureScriptingDefaults(settings: Settings): Settings {
  if (settings.scriptSandboxEnabled === undefined) {
    settings.scriptSandboxEnabled = true;
  }
  if (settings.scriptStrictModeEnabled === undefined) {
    settings.scriptStrictModeEnabled = true;
  }
  if (settings.scriptBlockUnresolvableProperties === undefined) {
    settings.scriptBlockUnresolvableProperties = true;
  }
  if (settings.disabledSecurityRules === undefined) {
    settings.disabledSecurityRules = [];
  }
  if (settings.disabledBlockedProperties === undefined) {
    settings.disabledBlockedProperties = [];
  }
  if (settings.disabledBlockedRoots === undefined) {
    settings.disabledBlockedRoots = [];
  }
  return settings;
}

/**
 * Ensure map is updated when new hotkeys are added
 */
function migrateEnsureHotKeys(settings: Settings): Settings {
  const defaultHotKeyRegistry = hotkeys.newDefaultRegistry();

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

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';

import type { ChangeBufferEvent, Settings } from '~/insomnia-data';
import { models, services } from '~/insomnia-data';
import type { KeyboardShortcut, KeyCombination, PluginConfigMap } from '~/insomnia-data/common';
import { getPlatformKeyCombinations, newDefaultRegistry } from '~/insomnia-data/common';
import { AnalyticsEvent } from '~/ui/analytics';
import { useOptimisticMutation } from '~/ui/stores/use-optimistic-mutation';

export const SETTINGS_STORE_KEY = ['settings'];

let registerCount = 0;
let unsubscribe: (() => void) | null = null;

function useDBListener() {
  const queryClient = useQueryClient();

  useEffect(() => {
    registerCount += 1;

    if (registerCount === 1) {
      unsubscribe = window.main.on('db.changes', (_, changes: ChangeBufferEvent[]) => {
        const hasSettingsChange = changes.some(([_, doc]) => doc.type === models.settings.type);
        if (hasSettingsChange) {
          queryClient.invalidateQueries({ queryKey: SETTINGS_STORE_KEY });
        }
      });
    }

    return () => {
      registerCount -= 1;

      if (registerCount === 0 && unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };
  }, [queryClient]);
}

export function useSettingsStore(selector?: (settings: Settings) => any) {
  const { data: settings, ...rest } = useQuery({
    queryKey: SETTINGS_STORE_KEY,
    queryFn: async () => {
      const settings = await services.settings.get();
      return settings;
    },
    selector,
  });

  // computed
  const httpProxyHasCredentials = settings?.httpProxy?.includes('@');
  const isProxyConfigured = Boolean(settings?.proxyEnabled && (settings.httpProxy || settings.httpsProxy));
  const hasCustomPluginPath = Boolean(settings?.pluginPath);
  const hasDataFolderRestrictions = Boolean(settings?.dataFolders && settings.dataFolders.length > 0);

  const { mutateResult, ...mutation } = useOptimisticMutation({
    mutationFn: async (patch: Partial<Settings>, { client }) => {
      const updatedSettings = await services.settings.patch(patch);
      client.setQueryData(SETTINGS_STORE_KEY, updatedSettings);
      if ('enableAnalytics' in patch && !patch.enableAnalytics) {
        window.main.trackAnalyticsEvent({ event: AnalyticsEvent.analyticsDisabled });
      }
      return updatedSettings;
    },
    invalidateKey: SETTINGS_STORE_KEY,
  });

  // --- Semantic actions ---
  const { mutate } = mutation;

  const resetHotKeys = useCallback(() => {
    mutate({ hotKeyRegistry: newDefaultRegistry() });
  }, [mutate]);

  const resetSingleHotKey = useCallback(
    (shortcut: KeyboardShortcut) => {
      mutateResult((settings: Settings) => {
        if (!settings?.hotKeyRegistry) {
          return settings;
        }
        const hotKeyRegistry = { ...settings.hotKeyRegistry, [shortcut]: newDefaultRegistry()[shortcut] };
        return { hotKeyRegistry };
      });
    },
    [mutateResult],
  );

  const addKeyCombination = useCallback(
    (shortcut: KeyboardShortcut, keyComb: KeyCombination) => {
      mutateResult((settings: Settings) => {
        if (!settings?.hotKeyRegistry) {
          return settings;
        }

        const hotKeyRegistry = structuredClone(settings.hotKeyRegistry);
        const keyCombs = getPlatformKeyCombinations(hotKeyRegistry[shortcut]);
        keyCombs.push(keyComb);
        return { hotKeyRegistry };
      });
    },
    [mutateResult],
  );

  const removeKeyCombination = useCallback(
    (shortcut: KeyboardShortcut, keyComb: KeyCombination) => {
      mutateResult((settings: Settings) => {
        if (!settings?.hotKeyRegistry) {
          return settings;
        }
        const hotKeyRegistry = structuredClone(settings.hotKeyRegistry);
        const keyCombs = getPlatformKeyCombinations(hotKeyRegistry[shortcut]);
        const idx = keyCombs.findIndex(
          k =>
            k.keyCode === keyComb.keyCode &&
            Boolean(k.alt) === Boolean(keyComb.alt) &&
            Boolean(k.shift) === Boolean(keyComb.shift) &&
            Boolean(k.ctrl) === Boolean(keyComb.ctrl) &&
            Boolean(k.meta) === Boolean(keyComb.meta),
        );
        if (idx !== -1) {
          keyCombs.splice(idx, 1);
          return { hotKeyRegistry };
        }
        return settings;
      });
    },
    [mutateResult],
  );

  const toggleVariableSourceAndValue = useCallback(() => {
    mutateResult((settings: Settings) => {
      if (!settings) {
        return settings;
      }
      return { showVariableSourceAndValue: !settings.showVariableSourceAndValue };
    });
  }, [mutateResult]);

  const togglePlugin = useCallback(
    (pluginName: string, enabled: boolean) => {
      mutateResult((settings: Settings) => {
        if (!settings?.pluginConfig) {
          return settings;
        }
        const pluginConfig: PluginConfigMap = {
          ...settings.pluginConfig,
          [pluginName]: { ...settings.pluginConfig[pluginName], disabled: !enabled },
        };
        return { pluginConfig };
      });
    },
    [mutateResult],
  );

  const toggleBulkHeaderEditor = useCallback(() => {
    mutateResult((settings: Settings) => {
      if (!settings) {
        return settings;
      }
      return { useBulkHeaderEditor: !settings.useBulkHeaderEditor };
    });
  }, [mutateResult]);

  const toggleBulkParametersEditor = useCallback(() => {
    mutateResult((settings: Settings) => {
      if (!settings) {
        return settings;
      }
      return { useBulkParametersEditor: !settings.useBulkParametersEditor };
    });
  }, [mutateResult]);

  useDBListener();

  return {
    settings,
    ...rest,
    // computed
    httpProxyHasCredentials,
    isProxyConfigured,
    hasCustomPluginPath,
    hasDataFolderRestrictions,
    // generic update
    mutation,
    // semantic actions
    resetHotKeys,
    resetSingleHotKey,
    addKeyCombination,
    removeKeyCombination,
    toggleVariableSourceAndValue,
    togglePlugin,
    toggleBulkHeaderEditor,
    toggleBulkParametersEditor,
  };
}

import React, { useCallback, useEffect } from 'react';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';
import { Outlet, useNavigate, useParams } from 'react-router';
import * as reactUse from 'react-use';

import { useEditorHistoryTabCleanup } from '~/ui/components/.client/codemirror/editor-history-cleanup';
import { AppLogo } from '~/ui/components/app-logo';
import { CommandPalette } from '~/ui/components/command-palette';
import { Hotkey } from '~/ui/components/hotkey';
import { Icon } from '~/ui/components/icon';
import { useDocBodyKeyboardShortcuts } from '~/ui/components/keydown-binder';
import { showSettingsModal } from '~/ui/components/modals/settings-modal';
import { TitleBarMenu } from '~/ui/components/title-bar-menu';
import { AppDataCacheProvider } from '~/ui/context/app/insomnia-app-data-context';
import { SidebarContext } from '~/ui/context/app/insomnia-sidebar-context';
import { InsomniaTabProvider } from '~/ui/context/app/insomnia-tab-context';
import { RunnerProvider } from '~/ui/context/app/runner-context';
import { useCloseConnection } from '~/ui/hooks/use-close-connection';
import { useSettingsPatcher } from '~/ui/hooks/use-request';
import { useRootLoaderData } from '~/ui/hooks/use-root-loader-data';

const titleBarButton =
  'flex h-[26px] w-[28px] items-center justify-center rounded-sm text-[14px] text-(--color-font) opacity-80 hover:opacity-100 transition-colors outline-none hover:bg-(--hl-sm) focus-visible:ring-1 focus-visible:ring-(--color-surprise)';
const titleBarTooltip =
  'flex min-w-max items-center gap-2 rounded-sm border border-solid border-(--hl-sm) bg-(--color-bg) px-2 py-1 text-xs text-(--color-font) shadow-lg select-none focus:outline-hidden';

const PanelIcon = ({ divider, filled }: { divider: string; filled?: string }) => (
  <svg viewBox="0 0 16 16" width={16} height={16} fill="none" stroke="currentColor" aria-hidden>
    <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" />
    {filled && <path d={filled} fill="currentColor" stroke="none" />}
    <path d={divider} />
  </svg>
);

const Component = () => {
  const { settings } = useRootLoaderData()!;
  const { organizationId } = useParams() as { organizationId: string };
  const navigate = useNavigate();
  const patchSettings = useSettingsPatcher();

  useCloseConnection({ organizationId });

  // Reclaim cached editor undo/redo history when tabs close, so switching between
  // open tabs never evicts a still-open tab's history from the shared cache.
  useEditorHistoryTabCleanup();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = reactUse.useLocalStorage('project-navigation-collapsed', false);

  const toggleSidebar = useCallback(
    () => setIsSidebarCollapsed(!isSidebarCollapsed),
    [isSidebarCollapsed, setIsSidebarCollapsed],
  );

  useEffect(() => {
    return window.main.on('toggle-sidebar', () => {
      toggleSidebar();
    });
  }, [toggleSidebar]);

  useDocBodyKeyboardShortcuts({ sidebar_toggle: toggleSidebar });

  return (
    <AppDataCacheProvider>
      <InsomniaTabProvider>
        <SidebarContext.Provider value={{ isSidebarCollapsed: isSidebarCollapsed ?? false, toggleSidebar }}>
          <div className="h-full w-full">
            <div className="grid-template-app-layout relative grid h-full w-full bg-(--color-bg)">
              <header className="app-titlebar theme--app-header grid grid-cols-[minmax(0,1fr)_minmax(0,auto)_minmax(0,1fr)] items-center gap-2 border-b border-solid border-(--hl-sm) bg-(--color-bg) text-(--color-font) [grid-area:Header]">
                <div className="flex h-full min-w-0 items-center gap-1 pl-1">
                  <AppLogo aria-hidden width={18} height={18} className="mx-[5px] shrink-0" />
                  <TitleBarMenu />
                </div>
                <div className="flex items-center gap-[4px]">
                  <Button aria-label="Go back" className={titleBarButton} onPress={() => navigate(-1)}>
                    <Icon icon="arrow-left" />
                  </Button>
                  <Button aria-label="Go forward" className={titleBarButton} onPress={() => navigate(1)}>
                    <Icon icon="arrow-right" />
                  </Button>
                  <CommandPalette />
                </div>
                <div className="flex h-full items-center justify-end gap-1 pr-1">
                  <TooltipTrigger>
                    <Button aria-label="Toggle sidebar" className={titleBarButton} onPress={toggleSidebar}>
                      <PanelIcon divider="M6 3v10" filled={isSidebarCollapsed ? undefined : 'M3 3h3v10H3z'} />
                    </Button>
                    <Tooltip placement="bottom" offset={4} className={titleBarTooltip}>
                      Toggle sidebar
                    </Tooltip>
                  </TooltipTrigger>
                  <TooltipTrigger>
                    <Button
                      aria-label="Toggle request layout"
                      className={titleBarButton}
                      onPress={() => patchSettings({ forceVerticalLayout: !settings.forceVerticalLayout })}
                    >
                      <PanelIcon divider={settings.forceVerticalLayout ? 'M2 8h12' : 'M8 3v10'} />
                    </Button>
                    <Tooltip placement="bottom" offset={4} className={titleBarTooltip}>
                      Toggle request layout
                    </Tooltip>
                  </TooltipTrigger>
                  <TooltipTrigger>
                    <Button
                      data-testid="settings-button"
                      aria-label="Preferences"
                      className={titleBarButton}
                      onPress={() => showSettingsModal()}
                    >
                      <Icon icon="gear" />
                    </Button>
                    <Tooltip placement="bottom" offset={4} className={titleBarTooltip}>
                      Preferences
                      <Hotkey keyBindings={settings.hotKeyRegistry.preferences_showGeneral} />
                    </Tooltip>
                  </TooltipTrigger>
                </div>
              </header>
              <div className="overflow-hidden [grid-area:Content]">
                <RunnerProvider>
                  <Outlet />
                </RunnerProvider>
              </div>
            </div>
          </div>
        </SidebarContext.Provider>
      </InsomniaTabProvider>
    </AppDataCacheProvider>
  );
};

export default Component;

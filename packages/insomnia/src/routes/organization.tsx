import React, { useCallback, useEffect } from 'react';
import { Button, Tooltip, TooltipTrigger } from 'react-aria-components';
import { href, NavLink, Outlet, useParams } from 'react-router';
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
import { useRootLoaderData } from '~/ui/hooks/use-root-loader-data';

const titleBarButton =
  'flex h-[22px] w-[26px] items-center justify-center rounded-sm text-xs text-(--color-font) transition-colors outline-none hover:bg-(--hl-sm) focus-visible:ring-1 focus-visible:ring-(--color-surprise)';
const titleBarTooltip =
  'flex min-w-max items-center gap-2 rounded-sm border border-solid border-(--hl-sm) bg-(--color-bg) px-2 py-1 text-xs text-(--color-font) shadow-lg select-none focus:outline-hidden';

const Component = () => {
  const { settings } = useRootLoaderData()!;
  const { organizationId } = useParams() as { organizationId: string };

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
              <header className="app-titlebar theme--app-header grid grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-2 border-b border-solid border-(--hl-sm) bg-(--color-bg) text-(--color-font) [grid-area:Header]">
                <div className="flex h-full min-w-0 items-center gap-1 pl-1">
                  <NavLink
                    aria-label="Home"
                    className="flex h-[22px] w-[26px] shrink-0 items-center justify-center rounded-sm hover:bg-(--hl-sm)"
                    to={href('/organization')}
                  >
                    <AppLogo width={16} height={16} />
                  </NavLink>
                  <TitleBarMenu />
                </div>
                <CommandPalette />
                <div className="flex h-full items-center justify-end gap-1 pr-1">
                  <TooltipTrigger>
                    <Button aria-label="Toggle sidebar" className={titleBarButton} onPress={toggleSidebar}>
                      <Icon icon={isSidebarCollapsed ? 'bars' : 'table-columns'} />
                    </Button>
                    <Tooltip placement="bottom" offset={4} className={titleBarTooltip}>
                      Toggle sidebar
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

import { Tab, TabList } from 'react-aria-components';

import { KongLogo } from '~/ui/components/kong-logo';

export const SideBarTabList = ({
  konnectSyncEnabled,
  isScratchPad,
  nonKonnectProjectLength,
  konnectProjectsLength,
}: {
  konnectSyncEnabled: boolean;
  isScratchPad: boolean;
  nonKonnectProjectLength: number;
  konnectProjectsLength: number;
}) => {
  return (
    <TabList
      aria-label="Sidebar navigation"
      className="flex h-(--line-height-sm) w-full shrink-0 border-b border-solid border-b-(--hl-md)"
    >
      <Tab
        id="projects"
        className={`flex h-full shrink-0 items-center justify-between px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none ${konnectSyncEnabled ? 'cursor-pointer hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)' : 'text-(--color-font)!'}`}
        data-testid="sidebar-tab-projects"
      >
        {isScratchPad ? 'Projects' : `Projects (${nonKonnectProjectLength})`}
      </Tab>
      {konnectSyncEnabled && !isScratchPad && (
        <Tab
          id="konnect"
          className="flex h-full shrink-0 cursor-pointer items-center justify-between px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
          data-testid="sidebar-tab-konnect"
        >
          <span className="flex items-center gap-2">
            <KongLogo />
            Konnect ({konnectProjectsLength})
          </span>
        </Tab>
      )}
    </TabList>
  );
};

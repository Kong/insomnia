import { isMac } from 'insomnia-data/common';
import { type FC, type KeyboardEvent, useEffect, useState } from 'react';
import { Button, Menu, MenuItem, MenuTrigger, Popover, Separator, SubmenuTrigger } from 'react-aria-components';

import type { AppMenuItem } from '~/main/title-bar';
import { Icon } from '~/ui/components/icon';

const popoverClass =
  'min-w-[240px] overflow-y-auto rounded-lg border border-solid border-(--hl-sm) bg-(--color-bg) p-[4px] text-[13px] text-(--color-font) shadow-lg select-none focus:outline-none';
const menuItemClass =
  'flex h-[28px] cursor-default items-center gap-[10px] rounded-sm px-[8px] outline-none data-[disabled]:opacity-40 data-[focused]:bg-(--color-surprise) data-[focused]:text-(--color-font-surprise) data-[open]:bg-(--hl-sm)';

const MenuItems: FC<{ items: AppMenuItem[]; onAction: (item: AppMenuItem) => void }> = ({ items, onAction }) => (
  <Menu aria-label="Menu" className="outline-none">
    {items.map(item => {
      if (item.type === 'separator') {
        return <Separator key={item.path.join('.')} className="my-[4px] border-(--hl-sm)" />;
      }
      const content = (
        <MenuItem
          key={item.path.join('.')}
          textValue={item.label}
          isDisabled={!item.enabled}
          className={menuItemClass}
          onAction={item.submenu ? undefined : () => onAction(item)}
        >
          <span className="flex w-[12px] shrink-0 justify-center">{item.checked && <Icon icon="check" />}</span>
          <span className="flex-1 truncate">{item.label}</span>
          {item.accelerator && <kbd className="ml-[16px] font-sans text-[12px] opacity-60">{item.accelerator}</kbd>}
          {item.submenu && <Icon icon="chevron-right" className="opacity-60" />}
        </MenuItem>
      );
      if (!item.submenu) {
        return content;
      }
      return (
        <SubmenuTrigger key={item.path.join('.')}>
          {content}
          <Popover className={popoverClass} offset={2}>
            <MenuItems items={item.submenu} onAction={onAction} />
          </Popover>
        </SubmenuTrigger>
      );
    })}
  </Menu>
);

// macOS keeps the native global menu, so this only renders on Windows and Linux
export const TitleBarMenu: FC = () => {
  const [menus, setMenus] = useState<AppMenuItem[]>([]);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  useEffect(() => {
    if (!isMac) {
      window.main.getAppMenu().then(setMenus);
    }
  }, [openMenu]);

  const moveMenu = (event: KeyboardEvent, label: string) => {
    if ((event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') || event.defaultPrevented) {
      return;
    }
    if ((event.target as HTMLElement).getAttribute('aria-haspopup') && event.key === 'ArrowRight') {
      return;
    }
    const index = menus.findIndex(menu => menu.label === label);
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    setOpenMenu(menus[(index + offset + menus.length) % menus.length].label);
  };

  return (
    <div role="menubar" aria-label="Application menu" className="flex h-full items-center">
      {menus.map(menu => (
        <MenuTrigger
          key={menu.label}
          isOpen={openMenu === menu.label}
          onOpenChange={isOpen => setOpenMenu(isOpen ? menu.label : null)}
        >
          <Button
            className="h-[24px] rounded-sm px-[8px] text-[13px] text-(--color-font) opacity-80 transition-colors outline-none hover:bg-(--hl-sm) hover:opacity-100 focus-visible:ring-1 focus-visible:ring-(--color-surprise) aria-expanded:bg-(--hl-sm) aria-expanded:opacity-100"
            onHoverStart={() => openMenu && setOpenMenu(menu.label)}
          >
            {menu.label}
          </Button>
          <Popover isNonModal placement="bottom start" offset={2} className={popoverClass}>
            <div onKeyDown={event => moveMenu(event, menu.label)}>
              <MenuItems items={menu.submenu ?? []} onAction={item => window.main.clickAppMenuItem(item.path)} />
            </div>
          </Popover>
        </MenuTrigger>
      ))}
    </div>
  );
};

import type { TabListProps, TabProps, TabsProps } from 'react-aria-components';
import { Collection, Tab as RaTab, TabList, TabPanel, Tabs as RaTabs } from 'react-aria-components';
import { twMerge } from 'tailwind-merge';

export const Tab = ({ children, ...props }: TabProps) => {
  return (
    <RaTab
      className={({ isHovered, isSelected, isDisabled }) =>
        twMerge(
          'flex cursor-default items-center justify-center gap-2 px-2 py-2',
          isHovered && 'bg-(--hl-xs)',
          isSelected && 'bg-(--hl-xs)',
          isDisabled && 'cursor-not-allowed text-(--hl)',
        )
      }
      {...props}
    >
      {children}
    </RaTab>
  );
};

interface TabItem {
  id: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  content: React.ReactNode;
  isDisabled?: boolean;
}
interface CustomTabsProps<T> extends Omit<TabsProps, keyof TabListProps<T>> {
  items: T[];
}

export const Tabs = ({ items, ...props }: CustomTabsProps<TabItem>) => {
  return (
    <RaTabs className="flex data-[orientation=horizontal]:flex-col data-[orientation=vertical]:flex-row" {...props}>
      <TabList
        className="flex border-(--hl-md) data-[orientation=horizontal]:mb-2 data-[orientation=horizontal]:border-b data-[orientation=vertical]:mr-2 data-[orientation=vertical]:flex-col data-[orientation=vertical]:border-r"
        aria-label="Insomnia tabs"
        items={items}
      >
        {item => (
          <Tab isDisabled={item.isDisabled}>
            {item.icon && <div className="">{item.icon}</div>}
            {item.title}
          </Tab>
        )}
      </TabList>
      <Collection items={items}>{item => <TabPanel>{item.content}</TabPanel>}</Collection>
    </RaTabs>
  );
};

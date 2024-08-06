import type { Node, Orientation } from '@react-types/shared';
import React, { createRef, type FC, type ReactNode } from 'react';
import { type AriaTabListProps, type AriaTabPanelProps, useTab, useTabList, useTabPanel } from 'react-aria';
import { Item, type ItemProps, type TabListState, useTabListState } from 'react-stately';

type TabItemProps = ItemProps<any>;

interface TabProps {
  item: Node<TabItemProps>;
  state: TabListState<TabItemProps>;
  orientation?: Orientation;
  isNested?: boolean;
}

const Tab: FC<TabProps> = ({ item, state, isNested }) => {
  const { key, rendered } = item;
  const ref = createRef<HTMLDivElement>();
  const { tabProps, isSelected } = useTab({ key }, state, ref);

  return (
    <div
      className={`focus:bg-[--hl-md] flex items-center justify-center whitespace-nowrap relative px-[--padding-md] text-[--hl] 
        ${isNested ? 'h-[--line-height-md]' : 'h-[--line-height-sm]'} 
        ${isNested ? 'border-none' : 'border-2 border-transparent'} 
        ${!isNested && isSelected ? 'border-l-2 border-r-2 border-[--hl-md]' : ''} 
        ${isNested && isSelected ? 'border-b-2 border-[--hl-xl]' : 'border-b-2 border-[--hl-md]'}`}
      {...tabProps}
      ref={ref}
    >
      {rendered}
    </div>
  );
};

interface TabPanelProps extends AriaTabPanelProps {
  state: TabListState<TabItemProps>;
}

const TabPanel: FC<TabPanelProps> = ({ state, ...props }) => {
  const ref = createRef<HTMLDivElement>();
  const { tabPanelProps } = useTabPanel(props, state, ref);

  return (
    <div
      className="w-full h-full relative box-border overflow-y-auto"
      {...tabPanelProps}
      ref={ref}
    >
      {state.selectedItem?.props.children}
    </div>
  );
};

interface TabsProps extends AriaTabListProps<TabItemProps> {
  isNested?: boolean;
}

const Tabs: FC<TabsProps> = props => {
  const state = useTabListState(props);
  const ref = createRef<HTMLDivElement>();
  const { tabListProps } = useTabList(props, state, ref);

  return (
    <div
      className="w-full h-full grid grid-rows-[auto] grid-rows-[minmax(0, 1fr)] grid-cols-[100%] content-stretch"
    >
      <div
        className="flex flex-row w-full h-full box-border bg-[--color-bg] overflow-auto"
        {...tabListProps}
        ref={ref}
      >
        {[...state.collection].map((item: Node<TabItemProps>) => (
          <Tab
            key={item.key}
            item={item}
            state={state}
            orientation={props.orientation}
            isNested={props.isNested}
          />
        ))}
      </div>
      <TabPanel
        key={state.selectedItem?.key}
        state={state}
      />
    </div>
  );
};

interface PanelContainerProps {
  className?: string;
  children: ReactNode;
}

const PanelContainer: FC<PanelContainerProps> = ({ className, children }) => {
  return (
    <div className={`w-full h-full relative box-border overflow-y-auto ${className || ''}`}>
      {children}
    </div>
  );
};

export { Tabs, Item as TabItem, PanelContainer };

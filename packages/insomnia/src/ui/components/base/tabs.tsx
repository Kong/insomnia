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
      className='focus:bg-[--hl-md]'
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        whiteSpace: 'nowrap',
        position: 'relative',
        padding: '0 var(--padding-md)',
        color: 'var(--hl)',
        height: isNested ? 'var(--line-height-md)' : 'var(--line-height-sm)',
        border: isNested ? 'none' : '1px solid transparent',
        borderTop: 'none',
        borderLeft: !isNested && isSelected ? '1px solid var(--hl-md)' : 'none',
        borderRight: !isNested && isSelected ? '1px solid var(--hl-md)' : 'none',
        borderBottom: isNested && isSelected ? '2px solid var(--hl-xl)' : '1px solid var(--hl-md)',
      }}
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
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        boxSizing: 'border-box',
        overflowY: 'auto',
      }}
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
      style={{
        width: '100%',
        height: '100%',
        display: 'grid',
        gridTemplateRows: 'auto minmax(0, 1fr)',
        gridTemplateColumns: '100%',
        alignContent: 'stretch',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          backgroundColor: 'var(--color-bg)',
          overflow: 'auto',
        }}
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
  return (<div
    style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      boxSizing: 'border-box',
      overflowY: 'auto',
    }}
    className={className}
  >{children}</div>);
};

export { Tabs, Item as TabItem, PanelContainer };

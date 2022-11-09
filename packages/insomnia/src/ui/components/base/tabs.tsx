import { Node, Orientation } from '@react-types/shared';
import classnames from 'classnames';
import React, { createRef, FC, ReactNode } from 'react';
import { AriaTabListProps, AriaTabPanelProps, useTab, useTabList, useTabPanel } from 'react-aria';
import { Item, ItemProps, TabListState, useTabListState } from 'react-stately';
import styled from 'styled-components';

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
  const { tabProps } = useTab({ key }, state, ref);

  return (
    <div {...tabProps} ref={ref} data-nested={isNested}>
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
    <div {...tabPanelProps} ref={ref}>
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
    <div className={classnames('tabs', props.orientation || '')}>
      <div {...tabListProps} ref={ref} data-nested={props.isNested}>
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

const StyledPanelContainer = styled.div({
  width: '100%',
  height: '100%',
  position: 'relative',
  boxSizing: 'border-box',
  overflow: 'auto',

  '&::-webkit-scrollbar': {
    display: 'none',
  },
});

const PanelContainer: FC<PanelContainerProps> = ({ className, children }) => {
  return (<StyledPanelContainer className={className}>{children}</StyledPanelContainer>);
};

export { Tabs, Item as TabItem, PanelContainer };

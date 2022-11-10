import { Node, Orientation } from '@react-types/shared';
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

interface StyledTabProps {
  isNested?: boolean;
  isSelected?: boolean;
}

const StyledTab = styled.div<StyledTabProps>(({ isNested, isSelected }) => ({
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
  borderBottom: isNested && isSelected ? '2px solid var(--hl-xl)' : 'none',

  '&:first-child': {
    borderLeft: '0 !important',
  },

  '&:focus': {
    outline: '0',
  },
}));

const Tab: FC<TabProps> = ({ item, state, isNested }) => {
  const { key, rendered } = item;
  const ref = createRef<HTMLDivElement>();
  const { tabProps, isSelected } = useTab({ key }, state, ref);

  return (
    <StyledTab {...tabProps} ref={ref} isSelected={isSelected} isNested={isNested}>
      {rendered}
    </StyledTab>
  );
};

interface TabPanelProps extends AriaTabPanelProps {
  state: TabListState<TabItemProps>;
}

const StyledTabPanel = styled.div({
  width: '100%',
  height: '100%',
  position: 'relative',
  boxSizing: 'border-box',
});

const TabPanel: FC<TabPanelProps> = ({ state, ...props }) => {
  const ref = createRef<HTMLDivElement>();
  const { tabPanelProps } = useTabPanel(props, state, ref);

  return (
    <StyledTabPanel {...tabPanelProps} ref={ref}>
      {state.selectedItem?.props.children}
    </StyledTabPanel>
  );
};

interface TabsProps extends AriaTabListProps<TabItemProps> {
  isNested?: boolean;
}

const StyledTabsContainer = styled.div({
  width: '100%',
  height: '100%',
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  gridTemplateColumns: '100%',
  alignContent: 'stretch',
});

interface StyledTabListProps {
  isNested?: boolean;
}

const StyledTabList = styled.div<StyledTabListProps>(({ isNested }) => ({
  display: 'flex',
  flexDirection: 'row',
  width: '100%',
  height: '100%',
  boxSizing: 'border-box',
  backgroundColor: 'var(--color-bg)',
  overflow: 'auto',
  borderBottom: isNested ? 'none' : '1px solid var(--hl-md)',

  '&::-webkit-scrollbar': {
    height: 'var(--padding-sm)',
    borderRadius: 'calc(var(--padding-sm) / 2)',
  },

  '&::-webkit-scrollbar-track': {
    backgroundColor: 'var(--color-bg)',
  },

  '&::-webkit-scrollbar-thumb': {
    backgroundColor: 'var(--hl-xxs)',
  },

  '&:hover::-webkit-scrollbar-thumb': {
    backgroundColor: 'var(--hl-sm)',
  },

  '&::after': {
    content: '',
    width: '100%',
    height: 'var(--line-height-sm)',
    borderBottom: isNested ? 'none' : '1px solid var(--hl-md)',
  },
}));

const Tabs: FC<TabsProps> = props => {
  const state = useTabListState(props);
  const ref = createRef<HTMLDivElement>();
  const { tabListProps } = useTabList(props, state, ref);

  return (
    <StyledTabsContainer>
      <StyledTabList {...tabListProps} ref={ref} isNested={props.isNested}>
        {[...state.collection].map((item: Node<TabItemProps>) => (
          <Tab
            key={item.key}
            item={item}
            state={state}
            orientation={props.orientation}
            isNested={props.isNested}
          />
        ))}
      </StyledTabList>
      <TabPanel
        key={state.selectedItem?.key}
        state={state}
      />
    </StyledTabsContainer>
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

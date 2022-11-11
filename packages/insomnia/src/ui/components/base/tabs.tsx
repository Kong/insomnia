import { Node, Orientation } from '@react-types/shared';
import React, { createRef, FC, ReactNode } from 'react';
import { AriaTabListProps, AriaTabPanelProps, useTab, useTabList, useTabPanel } from 'react-aria';
import { Item, ItemProps, TabListState, useTabListState } from 'react-stately';
import styled from 'styled-components';

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
  borderBottom: isNested && isSelected ? '2px solid var(--hl-xl)' : '1px solid var(--hl-md)',

  '&::after': !isSelected ? {
    content: '" "',
    position: 'absolute',
    top: '0',
    left: '0',
    right: '0',
    bottom: '0',
  } : {},

  '.bubble': {
    position: 'relative',
    bottom: '0.4em',
    fontSize: '0.8em',
    minWidth: '0.6em',
    background: 'var(--hl-sm)',
    padding: '2px',
    borderRadius: '3px',
    display: 'inline-block',
    textAlign: 'center',
    lineHeight: '0.8em',
    border: '1px solid var(--hl-xxs)',
  },

  '&:first-child': {
    borderLeft: '0 !important',
  },

  '&:focus-visible': {
    outline: '0',
  },

  '&:focus': isSelected && !isNested ? {
    backgroundColor: 'var(--hl-md)',
  } : {
    outline: '0',
  },

  ...isSelected && !isNested && {
    border: '1px solid var(--hl-md)',
    borderBottomColor: 'transparent',

    '*': {
      color: 'inherit',
    },
  },
}));

const StyledTabPanel = styled.div({
  width: '100%',
  height: '100%',
  position: 'relative',
  boxSizing: 'border-box',
  overflowY: 'auto',
});

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

  '&::-webkit-scrollbar': {
    height: 'var(--padding-xs)',
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
    content: '""',
    width: '100%',
    height: 'var(--line-height-sm)',
    borderBottom: isNested ? 'none' : '1px solid var(--hl-md)',
  },
}));

const StyledPanelContainer = styled.div({
  width: '100%',
  height: '100%',
  position: 'relative',
  boxSizing: 'border-box',
  overflowY: 'auto',

  '&::-webkit-scrollbar': {
    display: 'none',
  },
});

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
    <StyledTab {...tabProps} ref={ref} isSelected={isSelected} isNested={isNested}>
      {rendered}
    </StyledTab>
  );
};

interface TabPanelProps extends AriaTabPanelProps {
  state: TabListState<TabItemProps>;
}

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

const PanelContainer: FC<PanelContainerProps> = ({ className, children }) => {
  return (<StyledPanelContainer className={className}>{children}</StyledPanelContainer>);
};

export { Tabs, Item as TabItem, PanelContainer };

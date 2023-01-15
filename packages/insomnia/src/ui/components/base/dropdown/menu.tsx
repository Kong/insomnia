import type { AriaMenuProps } from '@react-types/menu';
import { Node } from '@react-types/shared';
import React, { useRef } from 'react';
import { useMenu } from 'react-aria';
import { TreeState, useTreeState } from 'react-stately';
import styled from 'styled-components';

import { MenuItem } from './menu-item';
import { MenuSection } from './menu-section';

const List = styled.ul({
  border: '1px solid var(--hl-sm)',
  boxShadow: '0 0 1rem 0 rgba(0, 0, 0, 0.1)',
  boxSizing: 'border-box',
  background: 'rgb(255,255,255)',
  margin: 'var(--padding-xxs) 3px',
  paddingTop: 'var(--radius-md)',
  paddingBottom: 'var(--radius-md)',
  borderRadius: 'var(--radius-md)',
  overflow: 'auto',

  '&:focus': {
    outline: '0',
  },
});

interface Props<T extends object> extends AriaMenuProps<T> {
  closeOnSelect?: boolean;
}

export const Menu = <T extends object>(props: Props<T>) => {
  // Create menu state based on the incoming props
  const state: TreeState<T> = useTreeState(props);

  // Get props for the menu element
  const ref = useRef<HTMLUListElement | null>(null);
  const { menuProps } = useMenu(props, state, ref);

  return (
    <List {...menuProps} ref={ref}>
      {[...state.collection].map((item: Node<T>) => (
        item.type === 'section' ?
          (
            <MenuSection
              key={item.key}
              section={item}
              state={state}
              onAction={props.onAction}
              onClose={props.onClose}
              closeOnSelect={props.closeOnSelect}
            />
          ) :
          item.rendered ? (
            <MenuItem
              key={item.key}
              item={item}
              state={state}
              onAction={props.onAction}
              onClose={props.onClose}
              closeOnSelect={props.closeOnSelect}
            />
          ) : null
      ))}
    </List>
  );
};

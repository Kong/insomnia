import { getItemCount } from '@react-stately/collections';
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
  background: 'var(--color-bg)',
  margin: 'var(--padding-xxs) 3px',
  paddingTop: 'var(--radius-md)',
  paddingBottom: 'var(--radius-md)',
  borderRadius: 'var(--radius-md)',
  overflowY: 'auto',
  maxHeight: '85vh',

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
    <List {...menuProps} ref={ref} className="dropdown__menu">
      {[...state.collection].map((item: Node<T>) => {
        // If the item is a section and the section has items, render a MenuSection
        // @ts-expect-error -- early deprecation
        if (item.type === 'section' && getItemCount(item.childNodes) !== 0) {
          return (
            <MenuSection
              key={item.key}
              section={item}
              state={state}
              closeOnSelect={props.closeOnSelect}
            />
          );
        }

        // If the item is a dropdown item and has content, render a MenuItem
        if (item.type === 'item' && item.rendered) {
          return (
            <MenuItem
              key={item.key}
              item={item}
              state={state}
              closeOnSelect={props.closeOnSelect}
            />
          );
        }

        return null;
      })}
    </List>
  );
};

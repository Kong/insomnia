import { Node } from '@react-types/shared';
import React, { Key } from 'react';
import { useRef } from 'react';
import { useMenuItem } from 'react-aria';
import { TreeState } from 'react-stately';
import styled from 'styled-components';

interface StyledListItemProps {
  isFocused?: boolean;
  isDisabled?: boolean;
}

const StyledListItem = styled.li<StyledListItemProps>(({ isFocused, isDisabled }) => ({
  display: 'flex',
  alignItems: 'center',
  height: '30px',
  minWidth: '15rem',
  fontSize: '1rem',
  textAlign: 'left',
  paddingRight: 'calc(1rem * 1.2)',
  paddingLeft: 'calc(1rem * 0.6)',
  margin: 0,
  whiteSpace: 'nowrap',
  backgroundColor: isFocused ? 'rgba(130, 130, 130, 0.25)' : 'transparent',
  color: isDisabled ? 'rgb(51,51,51)' : 'rgb(51,51,51)',
  cursor: isDisabled ? 'not-allowed' : 'pointer',

  '&:focus': {
    outline: '0',
  },
}));

interface Props<T> {
  item: Node<T>;
  state: TreeState<T>;
  onAction?: (key: Key) => void;
  onClose?: () => void;
}

export const MenuItem = <T extends object>({
  item,
  state,
  onAction,
  onClose,
}: Props<T>) => {
  const ref = useRef<HTMLLIElement | null>(null);
  const { key, rendered } = item;

  const {
    menuItemProps,
    isFocused,
    isDisabled,
  } = useMenuItem({ key, onAction, onClose }, state, ref);

  return (
    <StyledListItem
      {...menuItemProps}
      ref={ref}
      isFocused={isFocused}
      isDisabled={isDisabled}
    >
      {rendered}
    </StyledListItem>
  );
};

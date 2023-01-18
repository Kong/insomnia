import { Node } from '@react-types/shared';
import React from 'react';
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
  margin: 0,
  whiteSpace: 'nowrap',
  backgroundColor: isFocused ? 'rgba(130, 130, 130, 0.25)' : 'transparent',
  color: 'rgb(51,51,51)',
  cursor: isDisabled ? 'not-allowed' : 'pointer',

  '&:focus': {
    outline: '0',
  },
}));

interface Props<T> {
  item: Node<T>;
  state: TreeState<T>;
  closeOnSelect?: boolean;
}

export const MenuItem = <T extends object>({
  item,
  state,
  closeOnSelect,
}: Props<T>) => {
  const ref = useRef<HTMLLIElement>(null);

  // @ts-expect-error -- TSCONVERSION
  const withPrompt = item.rendered?.props?.withPrompt || false;
  // @ts-expect-error -- TSCONVERSION
  const onClick = item.rendered?.props?.onClick || undefined;
  // @ts-expect-error -- TSCONVERSION
  const isDisabled = item.rendered?.props?.isDisabled || false;
  // @ts-expect-error -- TSCONVERSION
  const stayOpenAfterClick = item.rendered?.props?.stayOpenAfterClick || false;

  // Close the menu if the item is not prompt or if user wants to stay open after click
  // of if the dropdown is not set to close on select.
  const shouldRemainOpen = withPrompt || stayOpenAfterClick;

  /**
   * We use this hack to allow for a prompt to be shown before the action is executed.
   * This is useful for things like deleting a document, where we want to show a prompt
   * before actually deleting the document.
   */
  const handleClick = () => {
    if (onClick && !isDisabled) {
      onClick();
    }
  };

  const {
    menuItemProps,
    isFocused,
  } = useMenuItem({
    key: item.key,
    closeOnSelect: closeOnSelect || !shouldRemainOpen,
    'aria-label': item['aria-label'],
    onAction: !withPrompt ? handleClick : undefined,
  }, state, ref);

  return (
    <StyledListItem
      {...menuItemProps}
      ref={ref}
      isFocused={isFocused}
      isDisabled={isDisabled}
    >
      {item.rendered}
    </StyledListItem>
  );
};

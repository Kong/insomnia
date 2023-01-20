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
  height: 'var(--line-height-xs)',
  minWidth: '15rem',
  fontSize: 'var(--font-size-md)',
  textAlign: 'left',
  margin: 0,
  whiteSpace: 'nowrap',
  color: 'var(--color-font)',
  background: isFocused ? 'var(--hl-sm)' : 'transparent',
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

  /**
   * We do this hack because the Dropdown item cannot been interactive
   * for more information see the following links:
   * 1. https://react-spectrum.adobe.com/react-aria/useMenu.html#:~:text=NOTE%3A%20menu%20items%20cannot%20contain%20interactive%20content%20(e.g.%20buttons%2C%20checkboxes%2C%20etc.).
   * 2. https://github.com/adobe/react-spectrum/issues/1244
   */
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

  const {
    menuItemProps,
    isFocused,
  } = useMenuItem({
    key: item.key,
    'aria-label': item['aria-label'],
    closeOnSelect: closeOnSelect || !shouldRemainOpen,
    onAction: !withPrompt && !isDisabled && onClick,
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

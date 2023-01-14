import type { Node } from '@react-types/shared';
import React, { Key } from 'react';
import { useMenuSection, useSeparator } from 'react-aria';
import { TreeState } from 'react-stately';
import styled from 'styled-components';

import { MenuItem } from './menu-item';

interface StyledDividerProps {
  withoutLabel?: boolean;
}

const StyledDividerContainer = styled.div<StyledDividerProps>({
  display: 'flex',
  alignItems: 'center',
  margin: '0 10px',
});

const StyledDividerSpan = styled.span<StyledDividerProps>({
  whiteSpace: 'nowrap',
  paddingRight: '1em',
  color: 'var(--hl)',
  fontSize: 'var(--font-size-xs)',
  textTransform: 'uppercase',
  margin: 'var(--padding-sm) 0',
});

const StyledDivider = styled.hr({
  margin: 'var(--padding-xs) 0',
});

const StyledList = styled.ul({
  padding: 0,
  listStyle: 'none',
});

interface Props<T> {
  dividerLabel?: string;
  section: Node<T>;
  state: TreeState<T>;
  onAction?: (key: Key) => void;
  onClose?: () => void;
}

export const MenuSection = <T extends object>({
  section,
  state,
  onAction,
  onClose,
}: Props<T>) => {
  const { itemProps, headingProps, groupProps } = useMenuSection({
    heading: section.rendered,
    'aria-label': section['aria-label'],
  });

  const { separatorProps } = useSeparator({ elementType: 'li' });

  return (
    <li {...itemProps}>
      <StyledDividerContainer>
        {section.rendered && <StyledDividerSpan {...headingProps}>{section.rendered}</StyledDividerSpan>}
        <StyledDivider {...separatorProps}/>
      </StyledDividerContainer>
      <StyledList {...groupProps}>
        {[...section.childNodes].map((node: Node<T>) => (
          node.rendered && <MenuItem
            key={node.key}
            item={node}
            state={state}
            onAction={onAction}
            onClose={onClose}
          />
        ))}
      </StyledList>
    </li>
  );
};

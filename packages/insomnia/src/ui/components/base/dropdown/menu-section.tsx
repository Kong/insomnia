import type { Node } from '@react-types/shared';
import React from 'react';
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
  background: 'var(--color-bg)',
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
  section: Node<T>;
  state: TreeState<T>;
  closeOnSelect?: boolean;
}

export const MenuSection = <T extends object>({
  section,
  state,
  closeOnSelect = true,
}: Props<T>) => {
  const { itemProps, headingProps, groupProps } = useMenuSection({
    heading: section.rendered,
    'aria-label': section['aria-label'],
  });

  const { separatorProps } = useSeparator({ elementType: 'li' });

  const shouldDisplayDivider = section.rendered || section.key !== state.collection.getFirstKey();

  return (
    <li {...itemProps}>
      <StyledDividerContainer>
        {section.rendered && <StyledDividerSpan {...headingProps}>{section.rendered}</StyledDividerSpan>}
        {shouldDisplayDivider && <StyledDivider {...separatorProps}/>}
      </StyledDividerContainer>
      <StyledList {...groupProps}>
        {[...section.childNodes].map((node: Node<T>) => (
          node.rendered && <MenuItem
            key={node.key}
            item={node}
            state={state}
            closeOnSelect={closeOnSelect}
          />
        ))}
      </StyledList>
    </li>
  );
};

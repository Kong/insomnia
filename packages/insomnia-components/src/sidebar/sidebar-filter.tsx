import { motion } from 'framer-motion';
import React, { createRef, FunctionComponent, useLayoutEffect } from 'react';
import styled from 'styled-components';

export interface SidebarFilterProps {
  filter: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

const StyledFilter = styled(motion.div)`
  padding-left: var(--padding-md);
  padding-right: var(--padding-md);
  overflow: hidden;
  input {
    box-sizing: border-box;
    width: 100%;
    font-size: var(--font-size-sm);
    padding: var(--padding-xs);
    margin-top: 0;
    margin-bottom: var(--padding-sm);
    outline-style: none;
    box-shadow: none;
    border: 1px solid var(--hl-md);
    color: var(--color-font);
    background: transparent;

    :focus::placeholder {
      color: transparent;
    }

    ::placeholder {
      color: var(--color-font);
    }
  }
`;

export const SidebarFilter: FunctionComponent<SidebarFilterProps> = ({ filter, onChange }) => {
  const filterField = createRef<HTMLInputElement>();

  useLayoutEffect(() => {
    if (filterField.current && !filter) {
      filterField.current.value = '';
    } else if (filterField.current) {
      filterField.current.focus();
    }
  }, [filter, filterField]);

  return (
    <StyledFilter
      initial={{
        height: filter ? '100%' : '0px',
      }}
      animate={{
        height: filter ? '100%' : '0px',
      }}>
      <input type="text" placeholder="Filter..." onChange={onChange} ref={filterField} />
    </StyledFilter>
  );
};

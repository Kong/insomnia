// @flow
import * as React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

type Props = {
  filter: boolean,
  children?: React.Node,
  transitionStyle: Object,
  onChange?: (e: SyntheticInputEvent<HTMLInputElement>) => any,
};

const StyledFilter: React.ComponentType<{}> = styled(motion.div)`
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

const SidebarFilter = ({ filter, children, transitionStyle, onChange }: Props) => (
  <StyledFilter
    initial={{ height: filter ? '100%' : '0px' }}
    animate={{ height: filter ? '100%' : '0px' }}
    transition={transitionStyle}>
    <input type="text" placeholder="Filter..." onChange={onChange} />
    {children}
  </StyledFilter>
);

export default SidebarFilter;

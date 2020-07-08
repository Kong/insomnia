// @flow
import * as React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import SvgIcon, { IconEnum } from '../svg-icon';

type Props = {
  headerTitle: string,
  toggleSection: Function,
  toggleFilter?: Function,
  section: boolean,
  children?: React.Node,
};

const StyledHeader: React.ComponentType<{}> = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:hover {
    background-color: var(--hl-xs);
  }

  h6:hover {
    text-decoration: underline;
  }

  label {
    color: red !important;
    position: absolute;
    padding-top: var(--padding-xs);
  }

  & > * {
    padding: var(--padding-md) var(--padding-md) var(--padding-md) var(--padding-md);
    font-size: var(--font-size-md);

    svg {
      margin-left: var(--padding-sm);

      &:hover {
        fill: var(--color-font);
        opacity: 1;
      }
    }
  }
`;

const SidebarHeader = ({ headerTitle, toggleSection, toggleFilter, section, children }: Props) => (
  <StyledHeader>
    <h6 onClick={toggleSection}>{headerTitle}</h6>
    <div>
      {children}
      {!children && (
        <motion.span
          onClick={toggleFilter}
          initial={{ opacity: section ? 0.6 : 0 }}
          animate={{ opacity: section ? 0.6 : 0 }}>
          <SvgIcon icon={IconEnum.search} />
        </motion.span>
      )}
    </div>
  </StyledHeader>
);

export default SidebarHeader;

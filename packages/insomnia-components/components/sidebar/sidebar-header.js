// @flow
import * as React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import SvgIcon, { IconEnum } from '../svg-icon';

type Props = {
  headerTitle: string,
  toggleSection: (toggle: SyntheticKeyboardEvent<HTMLButtonElement>) => void,
  toggleFilter?: () => void,
  sectionVisible: boolean,
  children?: React.Node,
};

const StyledHeader: React.ComponentType<{}> = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:hover {
    background-color: var(--hl-xs);
  }

  h6 {
    font-size: var(--font-size-xs);
    display: flex;
    flex-grow: 1;
    &:hover {
      cursor: default;
    }
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

const SidebarHeader = ({
  headerTitle,
  toggleSection,
  toggleFilter,
  sectionVisible,
  children,
}: Props) => (
  <StyledHeader>
    <h6 onClick={toggleSection}>{headerTitle}</h6>
    <div>
      {children || (
        <motion.span
          onClick={toggleFilter}
          initial={{ opacity: sectionVisible ? 0.6 : 0 }}
          animate={{ opacity: sectionVisible ? 0.6 : 0 }}>
          <SvgIcon icon={IconEnum.search} />
        </motion.span>
      )}
    </div>
  </StyledHeader>
);

export default SidebarHeader;

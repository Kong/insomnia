// @flow
import * as React from 'react';
import styled from 'styled-components';
import SvgIcon, { IconEnum } from '../svg-icon';

type Props = {
  headerTitle: string,
  children?: React.Node,
  onAddSuiteClick: Function,
};

const StyledHeader: React.ComponentType<{}> = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:hover {
    background-color: none !important;
    background: none !important;
    color: var(--color-font);
  }

  h6 {
    font-size: var(--font-size-sm);
    display: flex;
    flex-grow: 1;
    font-weight: var(--font-weight-bold);
    color: var(--color-font);
    &:hover {
      cursor: default;
    }
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
      font-size: var(--font-size-xl);

      &:hover {
        fill: var(--color-font);
        opacity: 1;
      }
    }
  }
`;

const SidebarHeaderUnitTesting = ({ headerTitle, children, onAddSuiteClick }: Props) => (
  <StyledHeader>
    <h6>{headerTitle}</h6>
    <span>
      <span onClick={onAddSuiteClick}>
        <SvgIcon icon={IconEnum.plus} />
      </span>
    </span>
  </StyledHeader>
);

export default SidebarHeaderUnitTesting;

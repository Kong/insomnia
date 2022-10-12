import React, { FunctionComponent, ReactNode } from 'react';
import styled from 'styled-components';

import { IconEnum, SvgIcon } from '../../svg-icon';

export interface SidebarHeaderProps {
  headerTitle: string;
  toggleSection: React.MouseEventHandler<HTMLLIElement>;
  toggleFilter?: () => void;
  sectionVisible: boolean;
  children?: ReactNode;
}

const StyledHeader = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:hover {
    background-color: var(--hl-xs);
  }

  h6 {
    font-size: var(--font-size-sm);
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
      font-size: var(--font-size-xl);

      &:hover {
        fill: var(--color-font);
        opacity: 1;
      }
    }
  }
`;

export const SidebarHeader: FunctionComponent<SidebarHeaderProps> = ({
  headerTitle,
  toggleSection,
  toggleFilter,
  sectionVisible,
  children,
}) => {
  const handleFilterClick: React.MouseEventHandler<HTMLSpanElement> | undefined =
    sectionVisible && toggleFilter // only handle a click if the section is open
      ? event => {
        event.stopPropagation(); // Prevent a parent from also handling the click

        toggleFilter();
      }
      : undefined;
  return (
    <StyledHeader onClick={toggleSection}>
      <h6>{headerTitle}</h6>
      <div>
        {children || (
          <span
            onClick={handleFilterClick}
            style={{ opacity: sectionVisible ? 0.6 : 0 }}
          >
            <SvgIcon icon={IconEnum.search} />
          </span>
        )}
      </div>
    </StyledHeader>
  );
};

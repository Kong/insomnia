import React, { FunctionComponent, useCallback } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

import type { GlobalActivity } from '../../../common/constants';
import { ACTIVITY_DEBUG, ACTIVITY_SPEC, ACTIVITY_UNIT_TEST } from '../../../common/constants';
import { isDesign, Workspace } from '../../../models/workspace';
import { HandleActivityChange } from '../wrapper';

const StyledNav = styled.nav`
  display: flex;
  justify-content: space-between;
  align-content: space-evenly;
  font-weight: 500;
  color: var(--color-font);
  background: var(--hl-xs);
  border: 0;
  border-radius: 100px;
  padding: var(--padding-xxs);
  transform: scale(0.9);
  transformOrigin: 'center';

  & > * :not(:last-child) {
    margin-right: var(--padding-xs);
  }
`;

const StyledLink = styled(Link)`
  min-width: 4rem;
  margin: 0 auto;
  text-transform: uppercase;
  text-align: center;
  font-size: var(--font-size-xs);
  padding: var(--padding-xs) var(--padding-xxs);
  border-radius: var(--line-height-sm);
  color: var(--hl)!important;
  background: transparent;

  &.active {
    color: var(--color-font)!important;
    background: var(--color-bg);
  }

  &:hover,
  &:active {
    text-decoration: none;
  }
`;

interface Props {
  activity: GlobalActivity;
  workspace: Workspace;
  handleActivityChange: HandleActivityChange;
}

export const ActivityToggle: FunctionComponent<Props> = ({
  activity,
  workspace,
  handleActivityChange,
}) => {
  const onChange = useCallback((e: React.MouseEvent<HTMLAnchorElement, MouseEvent>, nextActivity: GlobalActivity) => {
    // Prevent the default behavior in order to avoid extra re-render.
    e.preventDefault();
    handleActivityChange({
      workspaceId: workspace?._id,
      nextActivity,
    });
  }, [handleActivityChange, workspace]);

  if (!activity) {
    return null;
  }

  if (!workspace || !isDesign(workspace)) {
    return null;
  }

  return (
    <StyledNav>
      <StyledLink
        to={ACTIVITY_SPEC}
        className={activity === ACTIVITY_SPEC ? 'active' : undefined }
        onClick={e => {
          onChange(e, ACTIVITY_SPEC);
        }}
      >
        Design
      </StyledLink>
      <StyledLink
        to={ACTIVITY_DEBUG}
        className={activity === ACTIVITY_DEBUG ? 'active' : undefined }
        onClick={e => {
          onChange(e, ACTIVITY_DEBUG);
        }}
      >
        Debug
      </StyledLink>
      <StyledLink
        to={ACTIVITY_UNIT_TEST}
        className={activity === ACTIVITY_UNIT_TEST ? 'active' : undefined }
        onClick={e => {
          onChange(e, ACTIVITY_UNIT_TEST);
        }}
      >
        Test
      </StyledLink>
    </StyledNav>
  );
};

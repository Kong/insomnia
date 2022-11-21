import React, { FC } from 'react';
import { NavLink, useParams } from 'react-router-dom';
import styled from 'styled-components';

import { ACTIVITY_DEBUG, ACTIVITY_SPEC } from '../../common/constants';

const Nav = styled.nav({
  display: 'flex',
  justifyContent: 'space-between',
  alignContent: 'space-evenly',
  fontWeight: '500',
  color: 'var(--color-font)',
  background: 'var(--hl-xs)',
  border: '0',
  borderRadius: '100px',
  padding: 'var(--padding-xxs)',
  transform: 'scale(0.9)',
  transformOrigin: 'center',
  '& > * :not(:last-child)': {
    marginRight: 'var(--padding-xs)',
  },
});

const Link = styled(NavLink)({
  minWidth: '4rem',
  margin: '0 auto',
  textTransform: 'uppercase',
  textAlign: 'center',
  fontSize: 'var(--font-size-xs)',
  padding: 'var(--padding-xs) var(--padding-xxs)',
  borderRadius: 'var(--line-height-sm)',
  color: 'var(--hl)!important',
  background: 'transparent',
  '&.active': {
    color: 'var(--color-font)!important',
    background: 'var(--color-bg)',
  },
  '&:hover,&:active': {
    textDecoration: 'none',
  },
  '&:focus-visible': {
    outline: '0',
  },
});

export const ActivityToggle: FC = () => {
  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string}>();

  if (!workspaceId || !projectId || !organizationId) {
    return null;
  }

  const workspaceRoutePath = `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}`;

  return (
    <Nav>
      <Link
        to={`${workspaceRoutePath}/${ACTIVITY_SPEC}`}
        className={({ isActive }) => isActive ? 'active' : undefined }
      >
        Design
      </Link>
      <Link
        to={`${workspaceRoutePath}/${ACTIVITY_DEBUG}`}
        className={({ isActive }) => isActive ? 'active' : undefined }
      >
        Debug
      </Link>
      <Link
        to={`${workspaceRoutePath}/test`}
        className={({ isActive }) => isActive ? 'active' : undefined }
      >
        Test
      </Link>
    </Nav>
  );
};

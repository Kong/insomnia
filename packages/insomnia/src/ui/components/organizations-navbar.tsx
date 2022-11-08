import React, { FC } from 'react';
import { Link, useLoaderData, useParams } from 'react-router-dom';
import styled from 'styled-components';

import * as session from '../../account/session';
import { isDefaultOrganization } from '../../models/organization';
import { RootLoaderData } from '../routes/root';
import { Link as ExternalLink } from './base/link';
import { showAlert } from './modals';
import { SvgIcon } from './svg-icon';
import { Tooltip } from './tooltip';

const Navbar = styled.nav({
  gridArea: 'Navbar',
});

const NavbarList = styled.ul({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 'var(--padding-md)',
  width: '100%',
  height: '100%',
  overflowY: 'auto',
  padding: 'var(--padding-md) 0',
  borderRight: '1px solid var(--hl-md)',
  boxSizing: 'border-box',
});

const NavbarItem = styled(Link)<{
  isActive: boolean;
}>(props => ({
  padding: 'var(--padding-sm)',
  borderRadius: 'var(--radius-md)',
  width: '27px',
  height: '27px',
  boxSizing: 'border-box',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  outlineOffset: '3px',
  background: 'linear-gradient(137.34deg, #4000BF 4.44%, #154B62 95.33%)',
  '&&': {
    color: 'var(--color-font)',
    textDecoration: 'none',
  },
  fontWeight: 'bold',
  textShadow: '0 1px 0 var(--hl-md)',
  outline: `3px solid ${props.isActive ? 'var(--color-font)' : 'transparent'}`,
}));

const CreateButton = styled.button({
  padding: 'var(--padding-sm)',
  borderRadius: 'var(--radius-md)',
  width: '27px',
  height: '27px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  overflow: 'hidden',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: 'transparent',
});

export const OrganizationsNav: FC = () => {
  const { organizations } = useLoaderData() as RootLoaderData;
  const { organizationId } = useParams() as { organizationId:string };

  return (
    <Navbar>
      <NavbarList>
        {organizations.map(organization => {
          return (
            <li key={organization._id}>
              <NavbarItem
                to={`/organization/${organization._id}`}
                isActive={organizationId === organization._id}
              >
                <Tooltip position='right' message={organization.name}>
                  {isDefaultOrganization(organization) ? (<i className='fa fa-home' />) : organization.name.charAt(0).toUpperCase() + organization.name.slice(1).charAt(0).toUpperCase()}
                </Tooltip>
              </NavbarItem>
            </li>
          );
        })}
        <li>
          <CreateButton
            type="button"
            onClick={() => {
              if (session.isLoggedIn()) {
                showAlert({
                  title: 'This capability is coming soon',
                  message: 'At the moment it is not possible to create more Teams in Insomnia. We are working hard to enable this capability in the coming months, stay tuned.',
                });
              } else {
                showAlert({
                  title: 'Hey!',
                  okLabel: (
                    <ExternalLink
                      href='https://insomnia.rest/pricing'
                    >
                      <i className="fa fa-users" />{' '}Upgrade Now<i className="fa fa-star fa-outline" />
                    </ExternalLink>
                  ),
                  message: (
                    <div>
                      <p>{'You are currently not logged in. Log in or signup to store your project in the cloud or share it with your Team.'}</p>
                    </div>),
                });
              }
            }}
          >
            <Tooltip position='right' message="Create new project">
              <SvgIcon icon="plus" />
            </Tooltip>
          </CreateButton>
        </li>
      </NavbarList>
    </Navbar>
  );
};

import React, { FC } from 'react';
import { Link, useParams, useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import { getAppWebsiteBaseURL } from '../../common/constants';
import { getLoginUrl } from '../auth-session-provider';
import { isPersonalOrganization, OrganizationLoaderData } from '../routes/organization';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from './base/dropdown';
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
  $isActive: boolean;
}>(({ $isActive }) => ({
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
    color: 'var(--color-font-surprise)',
    textDecoration: 'none',
  },
  fontWeight: 'bold',
  textShadow: '0 1px 0 var(--hl-md)',
  outline: `3px solid ${$isActive ? 'var(--color-font)' : 'transparent'}`,
}));

const getNameInitials = (name: string) => {
  // Split on whitespace and take first letter of each word
  const words = name.toUpperCase().split(' ');
  const firstWord = words[0];
  const lastWord = words[words.length - 1];

  // If there is only one word, just take the first letter
  if (words.length === 1) {
    return firstWord.charAt(0);
  }

  // If the first word is an emoji or an icon then just use that
  const iconMatch = firstWord.match(/\p{Extended_Pictographic}/u);
  if (iconMatch) {
    return iconMatch[0];
  }

  return `${firstWord.charAt(0)}${lastWord ? lastWord.charAt(0) : ''}`;
};

export const OrganizationsNav: FC = () => {
  const { organizations } = useRouteLoaderData('/organization') as OrganizationLoaderData;
  const { organizationId } = useParams() as { organizationId:string };

  return (
    <Navbar>
      <NavbarList>
        {organizations.map(organization => {
          return (
            <li key={organization.id}>
              <Tooltip position='right' message={organization.display_name}>
                <NavbarItem
                  to={`/organization/${organization.id}`}
                  $isActive={organizationId === organization.id}
                >
                  {isPersonalOrganization(organization) ? (<i className='fa fa-home' />) : getNameInitials(organization.display_name)}

                </NavbarItem>
              </Tooltip>
            </li>
          );
        })}
        <li>
          <Dropdown
            placement='right top'
            triggerButton={
              <DropdownButton>
                <SvgIcon icon="plus" />
              </DropdownButton>
            }
          >
            <DropdownItem>
              <ItemContent
                label="Join an organization"
                onClick={() => {
                  window.main.openInBrowser(getLoginUrl());
                }}
              />
            </DropdownItem>
            <DropdownItem>
              <ItemContent
                label="Create new organization"
                onClick={() => {
                  window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/organization/create`);
                }}
              />
            </DropdownItem>
          </Dropdown>
        </li>
      </NavbarList>
    </Navbar>
  );
};

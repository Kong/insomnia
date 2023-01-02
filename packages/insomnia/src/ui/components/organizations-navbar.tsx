import React, { FC, useEffect, useRef, useState } from 'react';
import { Link, useLoaderData, useParams } from 'react-router-dom';
import styled from 'styled-components';

import * as session from '../../account/session';
import { isDefaultOrganization } from '../../models/organization';
import { RootLoaderData } from '../routes/root';
import { Link as ExternalLink } from './base/link';
import { Modal, ModalHandle } from './base/modal';
import { ModalBody } from './base/modal-body';
import { ModalFooter } from './base/modal-footer';
import { ModalHeader } from './base/modal-header';
import { showAlert } from './modals';
import { showLoginModal } from './modals/login-modal';
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

const SignupModal: FC<{onHide: () => void}> = ({
  onHide,
}) => {
  const modalRef = useRef<ModalHandle>(null);

  useEffect(() => {
    modalRef.current?.show();
  }, []);

  return (
    <Modal onHide={onHide} skinny ref={modalRef}>
      <ModalHeader>Login or sign up</ModalHeader>
      <ModalBody className="wide pad">
        Log in or sign up to create a new organization with Insomnia.
      </ModalBody>
      <ModalFooter>
        <div
          style={{
            display: 'flex',
            gap: 'var(--padding-md)',
          }}
        >
          <button
            className="btn btn--outlined"
            onClick={() => {
              modalRef.current?.hide();
              showLoginModal();
            }}
          >
            Login
          </button>

          <ExternalLink
            className="btn"
            onClick={() => {
              modalRef.current?.hide();
            }}
            button
            href="https://app.insomnia.rest/app/signup/"
          >
            Sign Up
          </ExternalLink>
        </div>
      </ModalFooter>
    </Modal>
  );
};

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
  const { organizations } = useLoaderData() as RootLoaderData;
  const { organizationId } = useParams() as { organizationId:string };
  const [isSignupModalOpen, setIsSignupModalOpen] = useState(false);
  return (
    <>
      <Navbar>
        <NavbarList>
          {organizations.map(organization => {
            return (
              <li key={organization._id}>
                <Tooltip position='right' message={organization.name}>
                  <NavbarItem
                    to={`/organization/${organization._id}`}
                    $isActive={organizationId === organization._id}
                  >
                    {isDefaultOrganization(organization) ? (<i className='fa fa-home' />) : getNameInitials(organization.name)}
                  </NavbarItem>
                </Tooltip>
              </li>
            );
          })}
          <li>
            <Tooltip position='right' message="Create new organization">
              <CreateButton
                type="button"
                onClick={() => {
                  if (session.isLoggedIn()) {
                    showAlert({
                      title: 'This capability is coming soon',
                      message: (
                        <div>
                          <p>
                            At the moment it is not possible to create more teams
                            in Insomnia.
                          </p>
                          <p>
                            🚀 This feature is coming soon!
                          </p>
                        </div>
                      ),
                    });
                  } else {
                    setIsSignupModalOpen(true);
                  }
                }}
              >

                <SvgIcon icon="plus" />
              </CreateButton>
            </Tooltip>
          </li>
        </NavbarList>
      </Navbar>
      {isSignupModalOpen ? <SignupModal onHide={() => setIsSignupModalOpen(false)} /> : null}
    </>
  );
};

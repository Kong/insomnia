import React, { FC } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';

import { getAccountId } from '../../../account/session';
import { getAppWebsiteBaseURL } from '../../../common/constants';
import { isOwnerOfOrganization } from '../../../models/organization';
import { useOrganizationLoaderData } from '../../../ui/routes/organization';
import { useRootLoaderData } from '../../routes/root';
import { showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';
import { AskModal } from '../modals/ask-modal';
import { Button } from '../themed-button';

const Wrapper = styled.div({
  height: '100%',
  width: '100%',
  boxSizing: 'border-box',
  display: 'flex',
  flexWrap: 'wrap',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  opacity: 'calc(var(--opacity-subtle) * 0.8)',
});

const Divider = styled.div({
  color: 'var(--color-font)',
  maxWidth: 500,
  width: '100%',
  margin: 'var(--padding-md) 0',
  display: 'flex',
  alignItems: 'center',
  fontSize: 'var(--text-sm)',
  '&::before': {
    content: '""',
    height: '1px',
    backgroundColor: 'var(--color-font)',
    flexGrow: '1',
    opacity: 'calc(var(--opacity-subtle) * 0.8)',
    marginRight: '1rem',
  },
  '&::after': {
    content: '""',
    height: '1px',
    backgroundColor: 'var(--color-font)',
    flexGrow: '1',
    opacity: 'calc(var(--opacity-subtle) * 0.8)',
    marginLeft: '1rem',
  },
});

const Title = styled.div({
  fontWeight: 'bold',
});

const SquareButton = styled(Button)({
  flexDirection: 'column',
  padding: 'var(--padding-xl)',
  gap: 'var(--padding-md)',
  maxWidth: 180,
  background: 'linear-gradient(120.49deg, var(--color-bg) 9.66%, var(--hl-md) 107.02%)',
});

const AlmostSquareButton = styled(Button)({
  flexDirection: 'column',
  maxWidth: 130,
  padding: '4em var(--padding-xl)',
  gap: 'var(--padding-md)',
  background: 'linear-gradient(120.49deg, var(--color-bg) 9.66%, var(--hl-md) 107.02%)',
});

interface Props {
  createRequestCollection: () => void;
  createDesignDocument: () => void;
  createMockServer: () => void;
  importFrom: () => void;
  cloneFromGit: () => void;
  isGitSyncEnabled: boolean;
}

export const EmptyStatePane: FC<Props> = ({ createRequestCollection, createDesignDocument, createMockServer, importFrom, cloneFromGit, isGitSyncEnabled }) => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { organizations } = useOrganizationLoaderData();
  const { userSession } = useRootLoaderData();
  const currentOrg = organizations.find(organization => (organization.id === organizationId));

  const accountId = getAccountId();

  const showUpgradePlanModal = () => {
    if (!currentOrg || !accountId) {
      return;
    }
    const isOwner = isOwnerOfOrganization({
      organization: currentOrg,
      accountId: userSession.accountId,
    });

    isOwner ?
      showModal(AskModal, {
        title: 'Upgrade Plan',
        message: 'Git Sync is only enabled for Team plan or above, please upgrade your plan.',
        yesText: 'Upgrade',
        noText: 'Cancel',
        onDone: async (isYes: boolean) => {
          if (isYes) {
            window.main.openInBrowser(`${getAppWebsiteBaseURL()}/app/subscription/update?plan=team`);
          }
        },
      }) : showModal(AlertModal, {
        title: 'Upgrade Plan',
        message: 'Git Sync is only enabled for Team plan or above, please ask the organization owner to upgrade.',
      });
  };

  return (
    <Wrapper>
      <Title>This is an empty project, to get started create your first resource:</Title>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
          gap: 'var(--padding-md)',
          marginTop: 'var(--padding-md)',
        }}
      >
        <SquareButton
          onClick={createRequestCollection}
        >
          <i
            className='fa fa-bars'
            style={{
              fontSize: 'var(--font-size-xl)',
            }}
          /> New Collection
        </SquareButton>
        <SquareButton
          onClick={createDesignDocument}
        >
          <i
            className='fa fa-file-o'
            style={{
              fontSize: 'var(--font-size-xl)',
            }}
          /> New Document
        </SquareButton>
        <SquareButton
          onClick={createMockServer}
        >
          <i
            className='fa fa-server'
            style={{
              fontSize: 'var(--font-size-xl)',
            }}
          /> New Mock Server
        </SquareButton>
      </div>
      <Divider
        style={{
          width: '100%',
        }}
      >
        or
      </Divider>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          width: '100%',
          gap: 'var(--padding-md)',
          marginTop: 'var(--padding-md)',
        }}
      >
        <AlmostSquareButton
          onClick={importFrom}
        >
          <i
            className='fa fa-file-import'
            style={{
              fontSize: 'var(--font-size-lg)',
            }}
          /> Import
        </AlmostSquareButton>
        <AlmostSquareButton
          onClick={importFrom}
        >
          <i
            className='fa fa-link'
            style={{
              fontSize: 'var(--font-size-lg)',
            }}
          /> Url
        </AlmostSquareButton>
        <AlmostSquareButton
          onClick={importFrom}
        >
          <i
            className='fa fa-clipboard'
            style={{
              fontSize: 'var(--font-size-lg)',
            }}
          /> Clipboard
        </AlmostSquareButton>
        <AlmostSquareButton
          aria-label='Clone git repository'
          onClick={
            () => {
              isGitSyncEnabled ?
                cloneFromGit() :
                showUpgradePlanModal();
            }
          }
        >
          <i
            className='fa fa-code-fork'
            style={{
              fontSize: 'var(--font-size-lg)',
            }}
          /> Git Clone
        </AlmostSquareButton>
        <AlmostSquareButton
          onClick={importFrom}
        >
          <span><i className="fa-regular fa-file fa-lg" /></span> Postman
        </AlmostSquareButton>
      </div>
    </Wrapper>
  );
};

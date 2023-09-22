import React, { FC } from 'react';
import { useParams, useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import { getAccountId } from '../../../account/session';
import { getAppWebsiteBaseURL } from '../../../common/constants';
import { isOwnerOfOrganization } from '../../../models/organization';
import { type FeatureList, useOrganizationLoaderData } from '../../../ui/routes/organization';
import { showModal } from '../modals';
import { AlertModal } from '../modals/alert-modal';
import { AskModal } from '../modals/ask-modal';
import { Button } from '../themed-button';

const PostmanIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M18.038.13a16 16 0 10-4.076 31.74A16 16 0 0018.038.13z"
        fill="var(--color-font)"
      />
      <path
        d="M11.567 17.011a.06.06 0 00.07.032l2.56-.552-1.076-1.091-1.534 1.534a.06.06 0 00-.02.077zM23.555 6.02a2.386 2.386 0 101.005 4.55l-1.623-1.623a.2.2 0 010-.283l2.12-2.118a2.386 2.386 0 00-1.502-.527z"
        fill="var(--color-bg)"
      />
      <path
        d="M25.348 6.82L23.361 8.8l1.558 1.558a2.4 2.4 0 00.429-3.538zM21.372 10.474h-.035a.621.621 0 00-.123.01h-.015a.938.938 0 00-.13.04l-.034.015a.627.627 0 00-.093.048l-.035.023a.833.833 0 00-.11.09l-5.892 5.894.73.73 6.24-5.478a.727.727 0 00.096-.102l.027-.035a.87.87 0 00.11-.234c0-.019.011-.038.016-.057a.934.934 0 00.016-.12v-.053-.086c0-.03 0-.039-.008-.058a.778.778 0 00-.61-.613h-.03a.835.835 0 00-.12-.014zM13.396 15.117l1.21 1.203 5.909-5.909c.192-.188.442-.305.71-.331-1.045-.8-2.184-.59-7.829 5.037zM22.207 12.077l-.072.07-6.24 5.475 1.061 1.06c2.63-2.488 4.965-4.858 5.252-6.605zM6.643 24.904a.058.058 0 00.051.041l2.72.188-1.525-1.525-1.233 1.232a.061.061 0 00-.013.064zM8.174 23.325l1.608 1.608a.122.122 0 00.152.02.12.12 0 00.062-.139l-.27-1.155a.346.346 0 01.177-.386c2.82-1.412 5.093-2.867 6.762-4.32l-1.12-1.12-2.4.517-4.971 4.975zM15.201 17.494l-.601-.601-.832.83a.04.04 0 000 .051.038.038 0 00.046.021l1.387-.3z"
        fill="var(--color-bg)"
      />
      <path
        d="M25.404 8.11a.185.185 0 10-.33.16.557.557 0 01-.07.602.185.185 0 00.285.237.926.926 0 00.115-.998z"
        fill="var(--color-font)"
      />
    </svg>
  );
};

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
  importFrom: () => void;
  cloneFromGit: () => void;
}

export const EmptyStatePane: FC<Props> = ({ createRequestCollection, createDesignDocument, importFrom, cloneFromGit }) => {
  const { organizationId } = useParams<{ organizationId: string }>();
  const { organizations } = useOrganizationLoaderData();
  const currentOrg = organizations.find(organization => (organization.id === organizationId));
  const { features } = useRouteLoaderData(':organizationId') as { features: FeatureList };

  const isGitSyncEnabled = features.gitSync.enabled;
  const accountId = getAccountId();

  const showUpgradePlanModal = () => {
    if (!currentOrg || !accountId) {
      return;
    }
    const isOwner = isOwnerOfOrganization({
      organization: currentOrg,
      accountId,
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
          <span><PostmanIcon /></span> Postman
        </AlmostSquareButton>
      </div>
    </Wrapper>
  );
};

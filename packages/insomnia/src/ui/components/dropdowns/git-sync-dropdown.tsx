import classnames from 'classnames';
import React, { FC, Fragment, useEffect, useRef, useState } from 'react';
import { useFetcher, useParams } from 'react-router-dom';

import { docsGitSync } from '../../../common/documentation';
import { GitRepository } from '../../../models/git-repository';
import { getOauth2FormatName } from '../../../sync/git/utils';
import { GitRepoLoaderData, PullFromGitRemoteResult, PushToGitRemoteResult } from '../../routes/git-actions';
import { type DropdownHandle, Dropdown, DropdownButton, DropdownItem, DropdownSection, ItemContent } from '../base/dropdown';
import { Link } from '../base/link';
import { HelpTooltip } from '../help-tooltip';
import { showAlert } from '../modals';
import { GitBranchesModal } from '../modals/git-branches-modal';
import { GitLogModal } from '../modals/git-log-modal';
import { GitRepositorySettingsModal } from '../modals/git-repository-settings-modal';
import { GitStagingModal } from '../modals/git-staging-modal';
import { Button } from '../themed-button';

interface Props {
  gitRepository: GitRepository | null;
  className?: string;
}

export const GitSyncDropdown: FC<Props> = ({ className, gitRepository }) => {
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };
  const dropdownRef = useRef<DropdownHandle>(null);

  const [isGitRepoSettingsModalOpen, setIsGitRepoSettingsModalOpen] = useState(false);
  const [isGitBranchesModalOpen, setIsGitBranchesModalOpen] = useState(false);
  const [isGitLogModalOpen, setIsGitLogModalOpen] = useState(false);
  const [isGitStagingModalOpen, setIsGitStagingModalOpen] = useState(false);

  const gitPushFetcher = useFetcher<PushToGitRemoteResult>();
  const gitPullFetcher = useFetcher<PullFromGitRemoteResult>();
  const gitCheckoutFetcher = useFetcher();
  const gitRepoDataFetcher = useFetcher<GitRepoLoaderData>();

  const loadingPush = gitPushFetcher.state === 'loading';
  const loadingPull = gitPullFetcher.state === 'loading';

  useEffect(() => {
    if (gitRepository?.uri && gitRepository?._id && gitRepoDataFetcher.state === 'idle' && !gitRepoDataFetcher.data) {
      gitRepoDataFetcher.load(`/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/repo`);
    }
  }, [gitRepoDataFetcher, gitRepository?.uri, gitRepository?._id, organizationId, projectId, workspaceId]);

  useEffect(() => {
    const errors = [
      ...gitPushFetcher.data?.errors ?? [],
    ];
    if (errors.length > 0) {
      showAlert({
        title: 'Push Failed',
        message: errors.join('\n'),
      });
    }
  }, [gitPushFetcher.data?.errors]);

  useEffect(() => {
    const errors = [
      ...gitPullFetcher.data?.errors ?? [],
    ];
    if (errors.length > 0) {
      showAlert({
        title: 'Pull Failed',
        message: errors.join('\n'),
      });
    }
  }, [gitPullFetcher.data?.errors]);

  useEffect(() => {
    const errors = [
      ...gitCheckoutFetcher.data?.errors ?? [],
    ];
    if (errors.length > 0) {
      showAlert({
        title: 'Checkout Failed',
        message: errors.join('\n'),
      });
    }
  }, [gitCheckoutFetcher.data?.errors]);

  async function handlePush({ force }: { force: boolean }) {
    gitPushFetcher.submit({
      force: `${force}`,
    }, {
      action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/push`,
      method: 'post',
    });
  }

  let iconClassName = '';
  const providerName = getOauth2FormatName(gitRepository?.credentials);
  if (providerName === 'github') {
    iconClassName = 'fa fa-github';
  }
  if (providerName === 'gitlab') {
    iconClassName = 'fa fa-gitlab';
  }

  const isLoading = gitRepoDataFetcher.state === 'loading';
  const isButton = !gitRepository || (isLoading && !gitRepoDataFetcher.data) || (gitRepoDataFetcher.data && 'errors' in gitRepoDataFetcher.data);

  const { log, branches, branch: currentBranch, remoteBranches } = (gitRepoDataFetcher.data && 'log' in gitRepoDataFetcher.data) ? gitRepoDataFetcher.data : { log: [], branches: [], branch: '', remoteBranches: [] };

  let dropdown: React.ReactNode = null;

  const currentBranchActions = [
    {
      id: 1,
      icon: 'check',
      label: 'Commit',
      onClick: () => setIsGitStagingModalOpen(true),
    },
    {
      id: 2,
      stayOpenAfterClick: true,
      icon: loadingPull ? 'refresh fa-spin' : 'cloud-download',
      label: 'Pull',
      onClick: async () => {
        gitPullFetcher.submit({}, {
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/pull`,
          method: 'post',
        });
      },
    },
    {
      id: 3,
      isDisabled: log.length === 0,
      icon: 'clock-o',
      label: <span>History ({log.length})</span>,
      onClick: () => setIsGitLogModalOpen(true),
    },
  ];

  if (log.length > 0) {
    currentBranchActions.splice(1, 0, {
      id: 4,
      stayOpenAfterClick: true,
      icon: loadingPush ? 'refresh fa-spin' : 'cloud-upload',
      label: 'Push',
      onClick: () => handlePush({ force: false }),
    });
  }

  if (isButton) {
    dropdown = (
      <Button
        disabled={isLoading}
        size="small"
        className="btn--clicky-small btn-sync"
        onClick={() => setIsGitRepoSettingsModalOpen(true)}
      >
        <i className={`fa fa-code-fork space-right ${isLoading ? 'fa-fade' : ''}`} />
        {isLoading ? 'Loading...' : 'Setup Git Sync'}
      </Button>
    );
  } else {
    dropdown = (
      <div className={className}>
        <Dropdown
          className="wide tall"
          ref={dropdownRef}
          triggerButton={
            <DropdownButton className="btn--clicky-small btn-sync">
              {iconClassName && (
                <i className={classnames('space-right', iconClassName)} />
              )}
              <div className="ellipsis">{currentBranch}</div>
              <i className={`fa fa-code-fork space-left ${isLoading ? 'fa-fade' : ''}`} />
            </DropdownButton>
          }
        >
          <DropdownSection
            title={
              <span>
                Git Sync
                <HelpTooltip>
                  Sync and collaborate with Git{' '}
                  <Link href={docsGitSync}>
                    <span className="no-wrap">
                      <br />
                      Documentation <i className="fa fa-external-link" />
                    </span>
                  </Link>
                </HelpTooltip>

              </span>
            }
          >
            <DropdownItem>
              <ItemContent
                icon="wrench"
                label="Repository Settings"
                onClick={() => {
                  setIsGitRepoSettingsModalOpen(true);
                }}
              />
            </DropdownItem>

            <DropdownItem>
              {currentBranch && (
                <ItemContent
                  icon="code-fork"
                  label="Branches"
                  onClick={() => {
                    setIsGitBranchesModalOpen(true);
                  }}
                />
              )}
            </DropdownItem>
          </DropdownSection>

          <DropdownSection
            title="Branches"
            items={currentBranch ? branches.map(b => ({ branch: b })) : []}
          >
            {({ branch }) => {
              const isCurrentBranch = branch === currentBranch;

              return (
                <DropdownItem
                  key={branch}
                  title={isCurrentBranch ? '' : `Switch to "${branch}"`}
                >
                  <ItemContent
                    className={classnames({ bold: isCurrentBranch })}
                    icon={branch === currentBranch ? 'tag' : 'empty'}
                    label={branch}
                    isDisabled={isCurrentBranch}
                    onClick={async () => {
                      gitCheckoutFetcher.submit({
                        branch,
                      }, {
                        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/branch/checkout`,
                        method: 'post',
                      });
                    }}
                  />
                </DropdownItem>
              );
            }}
          </DropdownSection>

          <DropdownSection
            title={currentBranch}
            items={currentBranch ? currentBranchActions : []}
          >
            {({ id, ...action }) =>
              <DropdownItem key={id}>
                <ItemContent {...action} />
              </DropdownItem>
            }
          </DropdownSection>
        </Dropdown>
      </div>
    );
  }

  return (
    <Fragment>
      {dropdown}
      {isGitRepoSettingsModalOpen && <GitRepositorySettingsModal gitRepository={gitRepository ?? undefined} onHide={() => setIsGitRepoSettingsModalOpen(false)} />}
      {isGitBranchesModalOpen &&
        <GitBranchesModal
          gitRepository={gitRepository}
          branches={branches}
          remoteBranches={remoteBranches}
          activeBranch={currentBranch}
          onHide={() => setIsGitBranchesModalOpen(false)}
        />
      }
      {isGitLogModalOpen && <GitLogModal branch={currentBranch} logs={log} onHide={() => setIsGitLogModalOpen(false)} />}
      {isGitStagingModalOpen &&
        <GitStagingModal
          onHide={() => setIsGitStagingModalOpen(false)}
        />
      }
    </Fragment>
  );
};

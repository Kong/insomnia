import classnames from 'classnames';
import React, { FC, Fragment, useEffect, useRef, useState } from 'react';
import { useFetcher, useParams } from 'react-router-dom';

import { docsGitSync } from '../../../common/documentation';
import { GitRepository } from '../../../models/git-repository';
import { getOauth2FormatName } from '../../../sync/git/utils';
import { GitRepoLoaderData, PushToGitRemoteResult } from '../../routes/git-actions';
import { type DropdownHandle, Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
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
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string};
  const dropdownRef = useRef<DropdownHandle>(null);

  const [isGitRepoSettingsModalOpen, setIsGitRepoSettingsModalOpen] = useState(false);
  const [isGitBranchesModalOpen, setIsGitBranchesModalOpen] = useState(false);
  const [isGitLogModalOpen, setIsGitLogModalOpen] = useState(false);
  const [isGitStagingModalOpen, setIsGitStagingModalOpen] = useState(false);

  const gitPushFetcher = useFetcher<PushToGitRemoteResult>();
  const gitPullFetcher = useFetcher();
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
      ...gitPullFetcher.data?.errors ?? [],
      ...gitCheckoutFetcher.data?.errors ?? [],
    ];
    if (errors.length > 0) {
      showAlert({
        title: 'Push Failed',
        message: errors.join('\n'),
      });
    }
  }, [gitCheckoutFetcher.data?.errors, gitPullFetcher.data?.errors, gitPushFetcher.data?.errors]);

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

  const { log, branches, branch: currentBranch, remoteBranches, changes, statusNames } = (gitRepoDataFetcher.data && 'log' in gitRepoDataFetcher.data) ? gitRepoDataFetcher.data : { log: [], branches: [], branch: '', remoteBranches: [], changes: [], statusNames: {} };

  let dropdown: React.ReactNode = null;

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
        <Dropdown className="wide tall" ref={dropdownRef}>
          <DropdownButton
            buttonClass={Button}
            // @ts-expect-error -- TSCONVERSION
            size="small"
            className="btn--clicky-small btn-sync"
          >
            {iconClassName && (
              <i className={classnames('space-right', iconClassName)} />
            )}
            <div className="ellipsis">{currentBranch}</div>
            <i className={`fa fa-code-fork space-left ${isLoading ? 'fa-fade' : ''}`} />
          </DropdownButton>

          <DropdownDivider>
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
          </DropdownDivider>

          <DropdownItem
            onClick={() => {
              setIsGitRepoSettingsModalOpen(true);
            }}
          >
            <i className="fa fa-wrench" /> Repository Settings
          </DropdownItem>

          {currentBranch && (
            <Fragment>
              <DropdownItem
                onClick={() => {
                  setIsGitBranchesModalOpen(true);
                }}
              >
                <i className="fa fa-code-fork" /> Branches
              </DropdownItem>
            </Fragment>
          )}

          {currentBranch && (
            <Fragment>
              <DropdownDivider>Branches</DropdownDivider>
              {branches.map(branch => {
                const icon = branch === currentBranch ? <i className="fa fa-tag" /> : <i className="fa fa-empty" />;
                const isCurrentBranch = branch === currentBranch;
                return (
                  <DropdownItem
                    key={branch}
                    disabled={isCurrentBranch}
                    onClick={async () => {
                      gitCheckoutFetcher.submit({
                        branch,
                      }, {
                        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/branch/checkout`,
                        method: 'post',
                      });
                    }}
                    className={classnames({ bold: isCurrentBranch })}
                    title={isCurrentBranch ? '' : `Switch to "${branch}"`}
                  >
                    {icon}
                    {branch}
                  </DropdownItem>
                );
              })}

              <DropdownDivider>{currentBranch}</DropdownDivider>

              <DropdownItem
                onClick={() => setIsGitStagingModalOpen(true)}
              >
                <i className="fa fa-check" /> Commit
              </DropdownItem>
              {log.length > 0 && (
                <DropdownItem onClick={() => handlePush({ force: false })} stayOpenAfterClick>
                  <i
                    className={classnames({
                      fa: true,
                      'fa-spin fa-refresh': loadingPush,
                      'fa-cloud-upload': !loadingPush,
                    })}
                  />{' '}
                  Push
                </DropdownItem>
              )}
              <DropdownItem
                onClick={async () => {
                  gitPullFetcher.submit({}, {
                    action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/pull`,
                    method: 'post',
                  });
                }}
                stayOpenAfterClick
              >
                <i
                  className={classnames({
                    fa: true,
                    'fa-spin fa-refresh': loadingPull,
                    'fa-cloud-download': !loadingPull,
                  })}
                />{' '}
                Pull
              </DropdownItem>
              <DropdownItem onClick={() => setIsGitLogModalOpen(true)} disabled={log.length === 0}>
                <i className="fa fa-clock-o" /> History ({log.length})
              </DropdownItem>
            </Fragment>
          )}
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
      {isGitStagingModalOpen && <GitStagingModal
        changes={changes}
        branch={currentBranch}
        statusNames={statusNames}
        onHide={() => setIsGitStagingModalOpen(false)}
      />}
    </Fragment>
  );
};

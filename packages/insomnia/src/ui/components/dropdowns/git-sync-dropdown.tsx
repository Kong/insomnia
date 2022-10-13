import classnames from 'classnames';
import React, { FC, Fragment, ReactNode, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';

import { SegmentEvent, trackSegmentEvent, vcsSegmentEventProperties } from '../../../common/analytics';
import { database as db } from '../../../common/database';
import { docsGitSync } from '../../../common/documentation';
import { isNotNullOrUndefined } from '../../../common/misc';
import * as models from '../../../models';
import type { GitRepository } from '../../../models/git-repository';
import type { Workspace } from '../../../models/workspace';
import type { GitLogEntry, GitVCS } from '../../../sync/git/git-vcs';
import { MemClient } from '../../../sync/git/mem-client';
import { getOauth2FormatName } from '../../../sync/git/utils';
import { initialize as initializeEntities } from '../../redux/modules/entities';
import * as gitActions from '../../redux/modules/git';
import { type DropdownHandle, Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownDivider } from '../base/dropdown/dropdown-divider';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { Link } from '../base/link';
import { HelpTooltip } from '../help-tooltip';
import { showAlert, showError, showModal } from '../modals';
import { GitBranchesModal } from '../modals/git-branches-modal';
import { GitLogModal } from '../modals/git-log-modal';
import { GitStagingModal } from '../modals/git-staging-modal';

interface Props {
  workspace: Workspace;
  vcs: GitVCS;
  gitRepository: GitRepository | null;
  className?: string;
  renderDropdownButton?: (children: ReactNode) => ReactNode;
}

interface State {
  initializing: boolean;
  loadingPush: boolean;
  loadingPull: boolean;
  log: GitLogEntry[];
  branch: string;
  branches: string[];
}
export const GitSyncDropdown: FC<Props> = props => {
  const [state, setState] = useState<State>({
    initializing: false,
    loadingPush: false,
    loadingPull: false,
    log: [],
    branch: '',
    branches: [],
  });
  const dispatch = useDispatch();
  const dropdownRef = useRef<DropdownHandle>(null);

  async function _refreshState() {
    const { vcs, workspace } = props;
    const workspaceMeta = await models.workspaceMeta.getOrCreateByParentId(workspace._id);

    // Clear cached items and return if no state
    if (!vcs.isInitialized() || !workspaceMeta.gitRepositoryId) {
      // Don't update unnecessarily
      const needsUpdate = [
        workspaceMeta.cachedGitRepositoryBranch,
        workspaceMeta.cachedGitLastAuthor,
        workspaceMeta.cachedGitLastCommitTime,
      ].some(isNotNullOrUndefined);

      if (needsUpdate) {
        await models.workspaceMeta.updateByParentId(workspace._id, {
          cachedGitRepositoryBranch: null,
          cachedGitLastAuthor: null,
          cachedGitLastCommitTime: null,
        });
      }

      return;
    }

    const branch = await vcs.getBranch();
    const branches = await vcs.listBranches();
    const log = (await vcs.log()) || [];
    setState(state => ({ ...state, log, branch, branches }));
    const author = log[0] ? log[0].commit.author : null;
    const cachedGitRepositoryBranch = branch;
    const cachedGitLastAuthor = author ? author.name : null;
    // NOTE: We're converting timestamp to ms here
    const cachedGitLastCommitTime = author ? author.timestamp * 1000 : null;
    await models.workspaceMeta.updateByParentId(workspace._id, {
      cachedGitRepositoryBranch,
      cachedGitLastAuthor,
      cachedGitLastCommitTime,
    });
  }
  async function _handlePull() {
    setState(state => ({
      ...state,
      loadingPull: true,
    }));
    const { vcs, gitRepository } = props;

    if (!gitRepository) {
      // Should never happen
      throw new Error('Tried to pull without configuring git repo');
    }

    const bufferId = await db.bufferChanges();
    const providerName = getOauth2FormatName(gitRepository.credentials);
    try {
      await vcs.pull(gitRepository.credentials);
      trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', 'pull'), providerName });
    } catch (err) {
      showError({
        title: 'Error Pulling Repository',
        error: err,
      });
      trackSegmentEvent(SegmentEvent.vcsAction, vcsSegmentEventProperties('git', 'pull', err.message));
    }

    await db.flushChanges(bufferId);
    setState(state => ({
      ...state,
      loadingPull: false,
    }));
  }

  async function _handlePush(_e: unknown, force = false) {
    setState(state => ({
      ...state,
      loadingPush: true,
    }));
    const { vcs, gitRepository } = props;

    if (!gitRepository) {
      // Should never happen
      throw new Error('Tried to push without configuring git repo');
    }

    // Check if there is anything to push
    let canPush = false;

    try {
      canPush = await vcs.canPush(gitRepository.credentials);
    } catch (err) {
      showError({
        title: 'Error Pushing Repository',
        error: err,
      });
      setState(state => ({
        ...state,
        loadingPush: false,
      }));
      return;
    }

    // If nothing to push, display that to the user
    if (!canPush) {
      showAlert({
        title: 'Push Skipped',
        message: 'Everything up-to-date. Nothing was pushed to the remote',
      });
      setState(state => ({
        ...state,
        loadingPush: false,
      }));
      return;
    }

    const bufferId = await db.bufferChanges();
    const providerName = getOauth2FormatName(gitRepository.credentials);
    try {
      await vcs.push(gitRepository.credentials, force);
      trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', force ? 'force_push' : 'push'), providerName });
    } catch (err) {
      if (err.code === 'PushRejectedError') {
        dropdownRef.current?.hide();
        showAlert({
          title: 'Push Rejected',
          message: 'Do you want to force push?',
          okLabel: 'Force Push',
          addCancel: true,
          onConfirm: () => {
            _handlePush(null, true);
          },
        });
      } else {
        showError({
          title: 'Error Pushing Repository',
          error: err,
        });
        trackSegmentEvent(SegmentEvent.vcsAction, { ...vcsSegmentEventProperties('git', force ? 'force_push' : 'push', err.message), providerName });
      }
    }

    await db.flushChanges(bufferId);
    setState(state => ({
      ...state,
      loadingPush: false,
    }));
  }

  function _handleConfig() {
    const { gitRepository, workspace } = props;

    if (gitRepository) {
      dispatch(gitActions.updateGitRepository({
        gitRepository,
      }));
    } else {
      dispatch(gitActions.setupGitRepository({
        workspace,
        createFsClient: MemClient.createClient,
      }));
    }
  }

  async function _handleCheckoutBranch(branch: string) {
    const { vcs } = props;
    const bufferId = await db.bufferChanges();

    try {
      await vcs.checkout(branch);
    } catch (err) {
      showError({
        title: 'Checkout Error',
        error: err,
      });
    }

    await db.flushChanges(bufferId, true);
    await dispatch(initializeEntities());
    await _refreshState();
  }
  const { className, vcs, renderDropdownButton, gitRepository } = props;
  const { log, branches, branch, loadingPull, loadingPush } = state;
  let iconClassName = '';
  const providerName = getOauth2FormatName(gitRepository?.credentials);
  if (providerName === 'github') {
    iconClassName = 'fa fa-github';
  }
  if (providerName === 'gitlab') {
    iconClassName = 'fa fa-gitlab';
  }
  const initializing = false;
  return (
    <div className={className}>
      <Dropdown className="wide tall" onOpen={() => _refreshState()} ref={dropdownRef}>
        {renderDropdownButton || vcs.isInitialized() ? (<DropdownButton className="btn btn--compact wide text-left overflow-hidden row-spaced" name="git-sync-dropdown-btn">
          {iconClassName && <i className={classnames('space-right', iconClassName)} />}
          <div className="ellipsis">{initializing ? 'Initializing...' : branch}</div>
          <i className="fa fa-code-fork space-left" />
        </DropdownButton>) :
          (<DropdownButton className="btn btn--compact wide text-left overflow-hidden row-spaced" name="git-sync-dropdown-btn">
            <i className="fa fa-code-fork space-right" />
            Setup Git Sync
          </DropdownButton>)}

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

        <DropdownItem onClick={_handleConfig}>
          <i className="fa fa-wrench" /> Repository Settings
        </DropdownItem>

        {vcs.isInitialized() && (
          <Fragment>
            <DropdownItem onClick={() => showModal(GitBranchesModal, { onHide: _refreshState })}>
              <i className="fa fa-code-fork" /> Branches
            </DropdownItem>
          </Fragment>
        )}

        {vcs.isInitialized() && (
          <Fragment>
            <DropdownDivider>Branches</DropdownDivider>
            {branches.map(branch => {
              const { branch: currentBranch } = state;
              const icon =
                branch === currentBranch ? <i className="fa fa-tag" /> : <i className="fa fa-empty" />;
              const isCurrentBranch = branch === currentBranch;
              return (
                <DropdownItem
                  key={branch}
                  onClick={isCurrentBranch ? undefined : () => _handleCheckoutBranch(branch)}
                  className={classnames({
                    bold: isCurrentBranch,
                  })}
                  title={isCurrentBranch ? '' : `Switch to "${branch}"`}
                >
                  {icon}
                  {branch}
                </DropdownItem>
              );
            })}

            <DropdownDivider>{branch}</DropdownDivider>

            <DropdownItem
              onClick={() => showModal(GitStagingModal, {
                onCommit: _refreshState,
                gitRepository,
              })}
            >
              <i className="fa fa-check" /> Commit
            </DropdownItem>
            {log.length > 0 && (
              <DropdownItem onClick={_handlePush} stayOpenAfterClick>
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
            <DropdownItem onClick={_handlePull} stayOpenAfterClick>
              <i
                className={classnames({
                  fa: true,
                  'fa-spin fa-refresh': loadingPull,
                  'fa-cloud-download': !loadingPull,
                })}
              />{' '}
              Pull
            </DropdownItem>
            <DropdownItem onClick={() => showModal(GitLogModal)} disabled={log.length === 0}>
              <i className="fa fa-clock-o" /> History ({log.length})
            </DropdownItem>
          </Fragment>
        )}
      </Dropdown>
    </div>
  );
};

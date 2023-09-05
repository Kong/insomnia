import React, { Key, useEffect, useRef, useState } from 'react';
import { OverlayContainer } from 'react-aria';
import { useFetcher, useParams } from 'react-router-dom';
import styled from 'styled-components';

import { docsGitSync } from '../../../../common/documentation';
import type { GitRepository, OauthProviderName } from '../../../../models/git-repository';
import { Link } from '../../base/link';
import { Modal, type ModalHandle, ModalProps } from '../../base/modal';
import { ModalBody } from '../../base/modal-body';
import { ModalFooter } from '../../base/modal-footer';
import { ModalHeader } from '../../base/modal-header';
import { PanelContainer, TabItem, Tabs } from '../../base/tabs';
import { ErrorBoundary } from '../../error-boundary';
import { HelpTooltip } from '../../help-tooltip';
import { showAlert } from '..';
import { CustomRepositorySettingsFormGroup } from './custom-repository-settings-form-group';
import { GitHubRepositorySetupFormGroup } from './github-repository-settings-form-group';
import { GitLabRepositorySetupFormGroup } from './gitlab-repository-settings-form-group';

const TabPill = styled.div({
  display: 'flex',
  gap: 'var(--padding-xs)',
  alignItems: 'center',
});

export const GitRepositorySettingsModal = (props: ModalProps & {
  gitRepository?: GitRepository;
}) => {
  const { organizationId, projectId, workspaceId } = useParams() as { organizationId: string; projectId: string; workspaceId: string };
  const { gitRepository } = props;
  const modalRef = useRef<ModalHandle>(null);
  const updateGitRepositoryFetcher = useFetcher();
  const deleteGitRepositoryFetcher = useFetcher();

  const [selectedTab, setTab] = useState<OauthProviderName>('github');

  useEffect(() => {
    modalRef.current?.show();
  }, []);

  const onSubmit = (gitRepositoryPatch: Partial<GitRepository>) => {
    const {
      author,
      credentials,
      created,
      modified,
      isPrivate,
      needsFullClone,
      uriNeedsMigration,
      ...repoPatch
    } = gitRepositoryPatch;

    updateGitRepositoryFetcher.submit(
      {
        ...repoPatch,
        authorName: author?.name || '',
        authorEmail: author?.email || '',
        ...credentials,
      },
      {
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/update`,
        method: 'post',
      }
    );
  };

  const isLoading = updateGitRepositoryFetcher.state !== 'idle';
  const hasGitRepository = Boolean(gitRepository);
  const errors = updateGitRepositoryFetcher.data?.errors as (Error | string)[];

  useEffect(() => {
    if (errors && errors.length) {
      const errorMessage = errors.map(e => e instanceof Error ? e.message : typeof e === 'string' && e).join(', ');

      showAlert({
        title: 'Error Cloning Repository',
        message: errorMessage,
      });
    }
  }, [errors]);

  return (
    <OverlayContainer>
      <Modal ref={modalRef} {...props}>
        <ModalHeader>
          Repository Settings{' '}
          <HelpTooltip>
            Sync and collaborate with Git
            <br />
            <Link href={docsGitSync}>Documentation {<i className="fa fa-external-link-square" />}</Link>
          </HelpTooltip>
        </ModalHeader>
        <ModalBody>
          <ErrorBoundary>
            <Tabs
              isDisabled={isLoading || hasGitRepository}
              aria-label="Git repository settings tabs"
              selectedKey={selectedTab}
              onSelectionChange={(key: Key) => setTab(key as OauthProviderName)}
            >
              <TabItem key='github' title={<TabPill><i className="fa fa-github" /> GitHub</TabPill>}>
                <PanelContainer className="pad pad-top-sm">
                  <GitHubRepositorySetupFormGroup
                    uri={gitRepository?.uri}
                    onSubmit={onSubmit}
                  />
                </PanelContainer>
              </TabItem>
              <TabItem key='gitlab' title={<TabPill><i className="fa fa-gitlab" /> GitLab</TabPill>}>
                <PanelContainer className="pad pad-top-sm">
                  <GitLabRepositorySetupFormGroup
                    uri={gitRepository?.uri}
                    onSubmit={onSubmit}
                  />
                </PanelContainer>
              </TabItem>
              <TabItem key='custom' title={<TabPill><i className="fa fa-code-fork" /> Git</TabPill>}>
                <PanelContainer className="pad pad-top-sm">
                  <CustomRepositorySettingsFormGroup
                    gitRepository={gitRepository}
                    onSubmit={onSubmit}
                  />
                </PanelContainer>
              </TabItem>
            </Tabs>
          </ErrorBoundary>
        </ModalBody>
        <ModalFooter>
          <div
            style={{
              display: 'flex',
              gap: 'var(--padding-md)',
            }}
          >
            <button
              className="btn"
              disabled={!gitRepository}
              onClick={() => {
                deleteGitRepositoryFetcher.submit({}, {
                  action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/git/reset`,
                  method: 'post',
                });
              }}
            >
              Reset
            </button>
            {hasGitRepository ? (
              <button
                type="button"
                onClick={() => modalRef.current?.hide()}
                className="btn"
                data-testid="git-repository-settings-modal__sync-btn-close"
              >
                Close
              </button>
            ) : (
              <button
                type="submit"
                disabled={isLoading}
                form={selectedTab}
                className="btn"
                data-testid="git-repository-settings-modal__sync-btn"
              >
                Sync
              </button>
            )}
          </div>
        </ModalFooter>
      </Modal>
    </OverlayContainer>
  );
};

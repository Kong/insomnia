import React, { Key, useEffect, useRef, useState } from 'react';
import { OverlayContainer } from 'react-aria';
import { useFetcher, useParams } from 'react-router-dom';

import { docsGitSync } from '../../../../common/documentation';
import type { GitRepository, OauthProviderName } from '../../../../models/git-repository';
import { Link } from '../../base/link';
import { type ModalHandle, Modal, ModalProps } from '../../base/modal';
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

  const isSubmitting = updateGitRepositoryFetcher.state === 'submitting';
  const errors = updateGitRepositoryFetcher.data?.errors as (Error | string)[];
  const isDisabled = isSubmitting || Boolean(gitRepository);

  useEffect(() => {
    if (errors && errors.length) {
      showAlert({
        title: 'Error Cloning Repository',
        message: errors.map(e => e instanceof Error ? e.message : typeof e === 'string' && e).join(''),
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
              isDisabled={isDisabled}
              aria-label="Git repository settings tabs"
              selectedKey={selectedTab}
              onSelectionChange={(key: Key) => setTab(key as OauthProviderName)}
            >
              <TabItem key='github' title={<><i className="fa fa-github" /> GitHub</>}>
                <PanelContainer className="pad pad-top-sm">
                  <GitHubRepositorySetupFormGroup
                    uri={gitRepository?.uri}
                    onSubmit={onSubmit}
                  />
                </PanelContainer>
              </TabItem>
              <TabItem key='gitlab' title={<><i className="fa fa-gitlab" /> GitLab</>}>
                <PanelContainer className="pad pad-top-sm">
                  <GitLabRepositorySetupFormGroup
                    uri={gitRepository?.uri}
                    onSubmit={onSubmit}
                  />
                </PanelContainer>
              </TabItem>
              <TabItem key='custom' title={<><i className="fa fa-code-fork" /> Git</>}>
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
            <button type="submit" disabled={isDisabled} form={selectedTab} className="btn" data-testid="git-repository-settings-modal__sync-btn">
              Sync
            </button>
          </div>
        </ModalFooter>
      </Modal>
    </OverlayContainer>
  );
};

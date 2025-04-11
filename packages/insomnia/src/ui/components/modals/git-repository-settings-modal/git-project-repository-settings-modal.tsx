import React, { useEffect, useRef, useState } from 'react';
import { OverlayContainer } from 'react-aria';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';

import { docsGitSync } from '../../../../common/documentation';
import type { GitRepository, OauthProviderName } from '../../../../models/git-repository';
import type { GitCredentials } from '../../../../sync/git/git-vcs';
import { Link } from '../../base/link';
import { Modal, type ModalHandle, type ModalProps } from '../../base/modal';
import { ModalBody } from '../../base/modal-body';
import { ModalFooter } from '../../base/modal-footer';
import { ModalHeader } from '../../base/modal-header';
import { ErrorBoundary } from '../../error-boundary';
import { CustomRepositorySettingsFormGroup } from '../../git-credentials/custom-repository-settings-form';
import { GitHubRepositorySetupFormGroup } from '../../git-credentials/github-repository-settings-form';
import { GitLabRepositorySetupFormGroup } from '../../git-credentials/gitlab-repository-settings-form';
import { HelpTooltip } from '../../help-tooltip';
import { showAlert } from '..';

function getDefaultOAuthProvider(credentials?: GitCredentials | null): OauthProviderName {
  if (!credentials) {
    return 'github';
  }

  if ('oauth2format' in credentials && credentials.oauth2format) {
    return credentials.oauth2format;
  }

  return 'custom';
}

export const GitProjectRepositorySettingsModal = ({
  gitRepository,
  ...modalProps
}: ModalProps & {
  gitRepository?: GitRepository;
}) => {
  const { organizationId, projectId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const modalRef = useRef<ModalHandle>(null);
  const updateGitRepositoryFetcher = useFetcher();
  const deleteGitRepositoryFetcher = useFetcher();

  const [selectedTab, setTab] = useState<OauthProviderName>(getDefaultOAuthProvider(gitRepository?.credentials));

  useEffect(() => {
    modalRef.current?.show();
  }, []);

  const onSubmit = (gitRepositoryPatch: Partial<GitRepository>) => {
    const { author, credentials, created, modified, isPrivate, needsFullClone, uriNeedsMigration, ...repoPatch } =
      gitRepositoryPatch;

    updateGitRepositoryFetcher.submit(
      {
        ...repoPatch,
        authorName: author?.name || '',
        authorEmail: author?.email || '',
        ...credentials,
      },
      {
        action: `/organization/${organizationId}/project/${projectId}/git/update`,
        method: 'post',
      },
    );
  };

  const isLoading = updateGitRepositoryFetcher.state !== 'idle';
  const hasGitRepository = Boolean(gitRepository);
  const errors = updateGitRepositoryFetcher.data?.errors as (Error | string)[];

  useEffect(() => {
    if (errors && errors.length) {
      const errorMessage = errors.map(e => (e instanceof Error ? e.message : typeof e === 'string' && e)).join(', ');

      showAlert({
        title: 'Error Cloning Repository',
        message: errorMessage,
      });
    }
  }, [errors]);

  return (
    <OverlayContainer>
      <Modal ref={modalRef} {...modalProps}>
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
              selectedKey={selectedTab}
              isDisabled={isLoading || hasGitRepository}
              onSelectionChange={key => {
                setTab(key as OauthProviderName);
              }}
              aria-label="Git repository settings tabs"
              className="flex h-full w-full flex-1 flex-col"
            >
              <TabList
                className="flex h-[--line-height-sm] w-full flex-shrink-0 items-center overflow-x-auto border-b border-solid border-b-[--hl-md] bg-[--color-bg]"
                aria-label="Request pane tabs"
              >
                <Tab
                  className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
                  id="github"
                >
                  <div className="flex items-center gap-2">
                    <i className="fa fa-github" /> GitHub
                  </div>
                </Tab>
                <Tab
                  className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
                  id="gitlab"
                >
                  <div className="flex items-center gap-2">
                    <i className="fa fa-gitlab" /> GitLab
                  </div>
                </Tab>
                <Tab
                  className="flex h-full flex-shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-[--hl] outline-none transition-colors duration-300 hover:bg-[--hl-sm] hover:text-[--color-font] focus:bg-[--hl-sm] aria-selected:bg-[--hl-xs] aria-selected:text-[--color-font] aria-selected:hover:bg-[--hl-sm] aria-selected:focus:bg-[--hl-sm]"
                  id="custom"
                >
                  <div className="flex items-center gap-2">
                    <i className="fa fa-code-fork" /> Git
                  </div>
                </Tab>
              </TabList>
              <TabPanel className="h-full w-full overflow-y-auto py-2" id="github">
                <GitHubRepositorySetupFormGroup uri={gitRepository?.uri} onSubmit={onSubmit} />
              </TabPanel>
              <TabPanel className="h-full w-full overflow-y-auto py-2" id="gitlab">
                <GitLabRepositorySetupFormGroup uri={gitRepository?.uri} onSubmit={onSubmit} />
              </TabPanel>
              <TabPanel className="h-full w-full overflow-y-auto py-2" id="custom">
                <CustomRepositorySettingsFormGroup gitRepository={gitRepository} onSubmit={onSubmit} />
              </TabPanel>
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
              disabled={!hasGitRepository}
              onClick={() => {
                deleteGitRepositoryFetcher.submit(
                  {},
                  {
                    action: `/organization/${organizationId}/project/${projectId}/git/reset`,
                    method: 'post',
                  },
                );
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

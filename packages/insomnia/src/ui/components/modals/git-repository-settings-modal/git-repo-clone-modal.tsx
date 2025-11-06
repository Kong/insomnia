import React, { useEffect, useRef, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { useParams } from 'react-router';

import { useGitCloneActionFetcher } from '~/routes/git.clone';

import { docsGitSync } from '../../../../common/documentation';
import type { GitRepository, OauthProviderName } from '../../../../models/git-repository';
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
import { showModal } from '..';
import { AlertModal } from '../alert-modal';

export const GitRepositoryCloneModal = (props: ModalProps) => {
  const { organizationId, projectId } = useParams() as { organizationId: string; projectId: string };
  const modalRef = useRef<ModalHandle>(null);
  const cloneGitRepositoryFetcher = useGitCloneActionFetcher();

  const [selectedTab, setTab] = useState<OauthProviderName>('github');

  useEffect(() => {
    modalRef.current?.show();
  }, []);

  const onSubmit = (gitRepositoryPatch: Partial<GitRepository>) => {
    const { author, credentials, uri } = gitRepositoryPatch;

    cloneGitRepositoryFetcher.submit({
      organizationId,
      projectId,
      uri: uri || '',
      author: {
        name: author?.name || '',
        email: author?.email || '',
      },
      credentials: credentials || {
        username: '',
        password: '',
      },
    });
  };

  const isSubmitting = cloneGitRepositoryFetcher.state === 'submitting';
  const errors = cloneGitRepositoryFetcher.data?.errors as (Error | string)[];
  useEffect(() => {
    if (errors && errors.length) {
      const errorMessage = errors.map(e => (e instanceof Error ? e.message : typeof e === 'string' && e)).join(', ');

      showModal(AlertModal, {
        title: 'Error Cloning Repository',
        message: errorMessage,
      });
    }
  }, [errors]);

  return (
    <Modal ref={modalRef} {...props}>
      <ModalHeader>
        Clone Repository{' '}
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
            onSelectionChange={key => {
              setTab(key as OauthProviderName);
            }}
            aria-label="Git repository settings tabs"
            className="flex h-full w-full flex-1 flex-col"
          >
            <TabList
              className="flex h-(--line-height-sm) w-full shrink-0 items-center overflow-x-auto border-b border-solid border-b-(--hl-md) bg-(--color-bg)"
              aria-label="Request pane tabs"
            >
              <Tab
                className="flex h-full shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
                id="github"
              >
                <div className="flex items-center gap-2">
                  <i className="fa fa-github" /> GitHub
                </div>
              </Tab>
              <Tab
                className="flex h-full shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
                id="gitlab"
              >
                <div className="flex items-center gap-2">
                  <i className="fa fa-gitlab" /> GitLab
                </div>
              </Tab>
              <Tab
                className="flex h-full shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
                id="custom"
              >
                <div className="flex items-center gap-2">
                  <i className="fa fa-code-fork" /> Git
                </div>
              </Tab>
            </TabList>
            <TabPanel className="h-full w-full overflow-y-auto py-2" id="github">
              <GitHubRepositorySetupFormGroup onSubmit={onSubmit} />
            </TabPanel>
            <TabPanel className="h-full w-full overflow-y-auto py-2" id="gitlab">
              <GitLabRepositorySetupFormGroup onSubmit={onSubmit} />
            </TabPanel>
            <TabPanel className="h-full w-full overflow-y-auto py-2" id="custom">
              <CustomRepositorySettingsFormGroup onSubmit={onSubmit} />
            </TabPanel>
          </Tabs>
        </ErrorBoundary>
      </ModalBody>
      <ModalFooter>
        <div>
          <button className="btn" onClick={() => modalRef.current?.hide()}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            form={selectedTab}
            className="btn"
            data-testid="git-repository-settings-modal__sync-btn"
          >
            Clone
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
};

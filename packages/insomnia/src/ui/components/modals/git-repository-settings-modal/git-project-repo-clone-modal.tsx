import React, { useEffect, useRef, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';

import { docsGitSync } from '../../../../common/documentation';
import type { GitRepository, OauthProviderName } from '../../../../models/git-repository';
import { Link } from '../../base/link';
import { Modal, type ModalHandle, type ModalProps } from '../../base/modal';
import { ModalBody } from '../../base/modal-body';
import { ModalFooter } from '../../base/modal-footer';
import { ModalHeader } from '../../base/modal-header';
import { ErrorBoundary } from '../../error-boundary';
import { HelpTooltip } from '../../help-tooltip';
import { showAlert } from '..';
import { CustomRepositorySettingsFormGroup } from './custom-repository-settings-form-group';
import { GitHubRepositorySetupFormGroup } from './github-repository-settings-form-group';
import { GitLabRepositorySetupFormGroup } from './gitlab-repository-settings-form-group';

export const GitProjectRepositoryCloneModal = (props: ModalProps) => {
  const { organizationId } = useParams() as { organizationId: string };
  const modalRef = useRef<ModalHandle>(null);
  const cloneGitRepositoryFetcher = useFetcher();

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

    cloneGitRepositoryFetcher.submit(
      {
        ...repoPatch,
        authorName: author?.name || '',
        authorEmail: author?.email || '',
        ...credentials,
      },
      {
        // file://./../../../routes/git-actions.tsx#cloneGitRepoAction
        action: `/organization/${organizationId}/git/clone`,
        method: 'post',
      }
    );
  };

  const isSubmitting = cloneGitRepositoryFetcher.state === 'submitting';
  const errors = cloneGitRepositoryFetcher.data?.errors as (Error | string)[];
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
            aria-label='Git repository settings tabs'
            className="flex-1 w-full h-full flex flex-col"
          >
            <TabList className='w-full flex-shrink-0  overflow-x-auto border-solid scro border-b border-b-[--hl-md] bg-[--color-bg] flex items-center h-[--line-height-sm]' aria-label='Request pane tabs'>
              <Tab
                className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
                id='github'
              >
                <div className="flex gap-2 items-center"><i className="fa fa-github" /> GitHub</div>
              </Tab>
              <Tab
                className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
                id='gitlab'
              >
                <div className="flex gap-2 items-center"><i className="fa fa-gitlab" /> GitLab</div>
              </Tab>
              <Tab
                className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
                id='custom'
              >
                <div className="flex gap-2 items-center"><i className="fa fa-code-fork" /> Git</div>
              </Tab>
            </TabList>
            <TabPanel className='w-full h-full overflow-y-auto py-2' id='github'>
              <GitHubRepositorySetupFormGroup
                onSubmit={onSubmit}
              />
            </TabPanel>
            <TabPanel className='w-full h-full overflow-y-auto py-2' id='gitlab'>
              <GitLabRepositorySetupFormGroup
                onSubmit={onSubmit}
              />
            </TabPanel>
            <TabPanel className='w-full h-full overflow-y-auto py-2' id='custom'>
              <CustomRepositorySettingsFormGroup
                onSubmit={onSubmit}
              />
            </TabPanel>
          </Tabs>
        </ErrorBoundary>
      </ModalBody>
      <ModalFooter>
        <div>
          <button className="btn" onClick={() => modalRef.current?.hide()}>
            Cancel
          </button>
          <button type="submit" disabled={isSubmitting} form={selectedTab} className="btn" data-testid="git-repository-settings-modal__sync-btn">
            Clone
          </button>
        </div>
      </ModalFooter>
    </Modal>
  );
};

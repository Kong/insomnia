import React, { useEffect, useRef, useState } from 'react';
import { Heading, ListBox, ListBoxItem, Tab, TabList, TabPanel, Tabs } from 'react-aria-components';
import { useFetcher, useParams } from 'react-router-dom';

import { docsGitSync } from '../../../../common/documentation';
import type { GitRepository, OauthProviderName } from '../../../../models/git-repository';
import type { CloneGitActionResult } from '../../../routes/git-actions';
import { scopeToBgColorMap, scopeToIconMap, scopeToLabelMap, scopeToTextColorMap } from '../../../routes/project';
import { Link } from '../../base/link';
import { Modal, type ModalHandle, type ModalProps } from '../../base/modal';
import { ModalBody } from '../../base/modal-body';
import { ModalFooter } from '../../base/modal-footer';
import { ModalHeader } from '../../base/modal-header';
import { ErrorBoundary } from '../../error-boundary';
import { HelpTooltip } from '../../help-tooltip';
import { Icon } from '../../icon';
import { showAlert } from '..';
import { CustomRepositorySettingsFormGroup } from './custom-repository-settings-form-group';
import { GitHubRepositorySetupFormGroup } from './github-repository-settings-form-group';
import { GitLabRepositorySetupFormGroup } from './gitlab-repository-settings-form-group';

export const GitRepositoryCloneModal = (props: ModalProps) => {
  const { organizationId, projectId } = useParams() as { organizationId: string; projectId: string };
  const modalRef = useRef<ModalHandle>(null);
  const cloneGitRepositoryFetcher = useFetcher<CloneGitActionResult>();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);

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
        workspaceId: selectedWorkspaceId || '',
      },
      {
        action: `/organization/${organizationId}/project/${projectId}/git/clone`,
        method: 'post',
      }
    );
  };

  const isSubmitting = cloneGitRepositoryFetcher.state === 'submitting';
  const errors = cloneGitRepositoryFetcher.data && 'errors' in cloneGitRepositoryFetcher.data && cloneGitRepositoryFetcher.data.errors;
  const workspaces = cloneGitRepositoryFetcher.data && 'workspaces' in cloneGitRepositoryFetcher.data && cloneGitRepositoryFetcher.data.workspaces;

  useEffect(() => {
    if (errors && errors.length) {
      const errorMessage = errors.join(', ');

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
        {workspaces && workspaces.length > 0 && (
          <>
            <Heading className='text-xl mb-2'>Choose which file you want to clone:</Heading>
            <ListBox
              onAction={key => {
                setSelectedWorkspaceId(key.toString());
              }}
              items={workspaces.map(workspace => ({
                id: workspace._id,
                ...workspace,
                isSelected: workspace._id === selectedWorkspaceId,
              }))}
            >
              {item => (
                <ListBoxItem className="flex gap-2 px-[--padding-md] aria-selected:font-bold items-center text-[--color-font] h-[--line-height-xs] w-full text-md whitespace-nowrap bg-transparent hover:bg-[--hl-sm] disabled:cursor-not-allowed focus:bg-[--hl-xs] focus:outline-none transition-colors">
                  <div className={`${scopeToBgColorMap[item.scope]} ${scopeToTextColorMap[item.scope]} px-2 flex justify-center items-center h-[20px] w-[20px] rounded-s-sm`}>
                    <Icon icon={scopeToIconMap[item.scope]} />
                  </div>
                  <span>{item.name}</span>
                  <span className='text-[--hl]'>{scopeToLabelMap[item.scope]}</span>
                  {item.isSelected && <i className="fa fa-check text-[--color-success]" />}
                </ListBoxItem>
              )}
            </ListBox>
          </>
        )
        }
        <ErrorBoundary>
          <Tabs
            selectedKey={selectedTab}
            onSelectionChange={key => {
              setTab(key as OauthProviderName);
            }}
            aria-label='Git repository settings tabs'
            className={`flex-1 w-full h-full flex flex-col ${workspaces && workspaces.length > 0 ? 'hidden' : ''}`}
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

import React, { useEffect, useState } from 'react';
import { Button, Cell, Column, Dialog, Heading, Input, Label, Modal, ModalOverlay, Radio, RadioGroup, Row, Tab, Table, TableBody, TableHeader, TabList, TabPanel, Tabs, TextField } from 'react-aria-components';
import { useFetcher, useNavigation, useParams } from 'react-router-dom';

import type { OauthProviderName } from '../../../models/git-credentials';
import type { GitRepository } from '../../../models/git-repository';
import { getDefaultProjectStorageType, type Project } from '../../../models/project';
import type { InitGitCloneResult } from '../../routes/git-project-actions';
import { ORG_STORAGE_RULE } from '../../routes/organization';
import { scopeToBgColorMap, scopeToIconMap, scopeToLabelMap, scopeToTextColorMap } from '../../routes/project';
import { ErrorBoundary } from '../error-boundary';
import { Icon } from '../icon';
import { InsomniaLogo } from '../insomnia-icon';
import { CustomRepositorySettingsFormGroup } from './git-repository-settings-modal/custom-repository-settings-form-group';
import { GitHubRepositorySetupFormGroup } from './git-repository-settings-modal/github-repository-settings-form-group';
import { GitLabRepositorySetupFormGroup } from './git-repository-settings-modal/gitlab-repository-settings-form-group';

export const ProjectModal = ({
  isOpen,
  onOpenChange,
  storageRule,
  isGitSyncEnabled,
  project,
  gitRepository,
}: {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  storageRule: ORG_STORAGE_RULE;
  isGitSyncEnabled: boolean;
  project?: Project;
  gitRepository?: GitRepository;
}) => {
  const { organizationId } = useParams() as { organizationId: string; projectId: string };
  const [projectData, setProjectData] = useState<{
    name: string;
    storageType: 'local' | 'remote' | 'git';
    authorName?: string;
    authorEmail?: string;
    uri?: string;
    username?: string;
    password?: string;
    token?: string;
    oauth2format: OauthProviderName;
  }>({
    name: project?.name || 'New Project',
    storageType: getDefaultProjectStorageType(storageRule, project),
    authorName: gitRepository?.author?.name || '',
    authorEmail: gitRepository?.author?.email || '',
    uri: gitRepository?.uri || '',
    username: gitRepository?.credentials?.username || '',
    password: gitRepository?.credentials && 'password' in gitRepository.credentials ? gitRepository?.credentials?.password : '',
    token: gitRepository?.credentials && 'token' in gitRepository.credentials ? gitRepository?.credentials?.token : '',
    oauth2format: gitRepository?.credentials && 'oauth2format' in gitRepository.credentials ? gitRepository?.credentials?.oauth2format ?? 'github' : 'github',
  });

  const [activeView, setActiveView] = useState<'project' | 'git-clone' | 'git-results'>('project');
  const [selectedTab, setTab] = useState<OauthProviderName>('github');

  const showStorageRestrictionMessage = storageRule !== ORG_STORAGE_RULE.CLOUD_PLUS_LOCAL;
  const initCloneGitRepositoryFetcher = useFetcher<InitGitCloneResult>();
  const upsertProjectFetcher = useFetcher();

  const insomniaFiles = initCloneGitRepositoryFetcher.data && 'files' in initCloneGitRepositoryFetcher.data ? initCloneGitRepositoryFetcher.data.files : [];

  const onGitRepoFormSubmit = (gitRepositoryPatch: Partial<GitRepository>) => {
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

    setProjectData({
      ...projectData,
      ...credentials,
      authorName: author?.name || '',
      authorEmail: author?.email || '',
      uri: repoPatch.uri,
    });

    initCloneGitRepositoryFetcher.submit(
      {
        ...repoPatch,
        authorName: author?.name || '',
        authorEmail: author?.email || '',
        ...credentials,
      },
      {
        action: `/organization/${organizationId}/git/init-clone`,
        method: 'POST',
      }
    );

    setActiveView('git-results');
  };

  const onCreateProject = () => {
    const action = project ? `/organization/${organizationId}/project/${project._id}/update` : `/organization/${organizationId}/project/new`;

    upsertProjectFetcher.submit(
      projectData,
      {
        action,
        method: 'POST',
        encType: 'application/json',
      }
    );
  };

  // Close the modal when a navigation happens
  const activeNavigation = useNavigation();

  useEffect(() => {
    if (activeNavigation && activeNavigation.state !== 'idle' && activeNavigation.location && isOpen) {
      onOpenChange(false);
    }
  }, [activeNavigation, isOpen, onOpenChange]);

  const title = project ? 'Update project' : 'Create a new project';

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable className="w-full h-[--visual-viewport-height] fixed z-10 top-0 left-0 flex items-center justify-center bg-black/30">
      <Modal
        className="max-w-3xl w-full rounded-md border border-solid border-[--hl-sm] max-h-[90dvh] min-h-[420px] bg-[--color-bg] text-[--color-font] flex flex-col overflow-hidden"
      >
        <Dialog
          aria-label='Create or update dialog'
          className="outline-none flex-1 gap-4 grid [grid-template-rows:min-content_1fr_min-content]"
        >
          {({ close }) => (
            <>
              <div className='pt-10 px-10 flex gap-2 items-center justify-between'>
                <Heading slot="title" className='text-2xl'>{title}</Heading>
                <Button
                  className="flex flex-shrink-0 items-center justify-center aspect-square h-6 aria-pressed:bg-[--hl-sm] rounded-sm text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm"
                  onPress={close}
                >
                  <Icon icon="x" />
                </Button>
              </div>

              {activeView === 'project' && (
                <>
                  <div className='flex flex-col justify-start gap-2 overflow-y-auto px-10'>
                    <TextField
                      autoFocus
                      name="name"
                      value={projectData.name}
                      onChange={name => setProjectData({ ...projectData, name })}
                      className="group relative flex flex-col gap-2"
                    >
                      <Label className='text-sm text-[--hl]'>
                        Project name
                      </Label>
                      <Input
                        placeholder="My project"
                        className="py-1 placeholder:italic w-full pl-2 pr-7 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
                      />
                    </TextField>
                    <RadioGroup
                      name="type"
                      className="flex flex-col gap-2"
                      onChange={value => setProjectData({ ...projectData, storageType: value as 'local' | 'remote' | 'git' })}
                      value={projectData.storageType}
                    >
                      <Label className="text-sm text-[--hl]">
                        Project type
                      </Label>
                      <div className="flex gap-2">
                        <Radio
                          isDisabled={!isGitSyncEnabled}
                          value="git"
                          className="flex-1 data-[selected]:border-[--color-surprise] data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] data-[disabled]:opacity-25 hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                        >
                          <div className='flex items-center gap-2'>
                            <Icon icon={['fab', 'git-alt']} />
                            <Heading className="text-lg font-bold">Git Sync</Heading>
                          </div>
                          <p className='pt-2'>
                            Stored locally and synced to a Git repository. Ideal for version control and collaboration.
                          </p>
                        </Radio>
                        <Radio
                          isDisabled={storageRule === ORG_STORAGE_RULE.LOCAL_ONLY}
                          value="remote"
                          className="flex-1 data-[selected]:border-[--color-surprise] data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] data-[disabled]:opacity-25 hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                        >
                          <div className='flex items-center gap-2'>
                            <Icon icon="globe" />
                            <Heading className="text-lg font-bold">Cloud Sync</Heading>
                          </div>
                          <p className='pt-2'>
                            Encrypted and synced securely to the cloud, ideal for out of the box collaboration.
                          </p>
                        </Radio>
                        <Radio
                          isDisabled={storageRule === ORG_STORAGE_RULE.CLOUD_ONLY}
                          value="local"
                          className="flex-1 data-[selected]:border-[--color-surprise] data-[selected]:ring-2 data-[selected]:ring-[--color-surprise] data-[disabled]:opacity-25 hover:bg-[--hl-xs] focus:bg-[--hl-sm] border border-solid border-[--hl-md] rounded p-4 focus:outline-none transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <Icon icon="laptop" />
                            <Heading className="text-lg font-bold">Local Vault</Heading>
                          </div>
                          <p className="pt-2">
                            Stored locally only with no cloud. Ideal when collaboration is not needed.
                          </p>
                        </Radio>
                      </div>
                    </RadioGroup>
                    {showStorageRestrictionMessage && (
                      <div className="flex items-center px-2 py-1 gap-2 text-sm rounded-sm text-[--color-font-warning] bg-[rgba(var(--color-warning-rgb),0.5)]">
                        <Icon icon="triangle-exclamation" />
                        <span>
                          The organization owner mandates that projects must be created and stored {storageRule.split('_').join(' ')}.
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex justify-between gap-2 items-center px-10 pb-10">
                    <div className='flex flex-col gap-1'>
                      {projectData.storageType !== 'git' && (
                        <div className="flex items-center gap-2 text-sm">
                          <Icon icon="info-circle" />
                          <span>
                            You can optionally enable Git Sync
                          </span>
                        </div>
                      )}
                    </div>
                    <div className='flex items-center gap-2'>
                      <Button
                        onPress={close}
                        className="hover:no-underline hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
                      >
                        Cancel
                      </Button>
                      {projectData.storageType === 'git' && (
                        <Button
                          onPress={() => setActiveView('git-clone')}
                          className="hover:no-underline w-[10ch] text-center bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
                        >
                          Next
                        </Button>
                      )}
                      {projectData.storageType !== 'git' && (
                        <Button
                          onPress={onCreateProject}
                          className="hover:no-underline w-[10ch] text-center bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
                        >
                          Create
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {activeView === 'git-clone' && (
                <>
                  <ErrorBoundary>
                    <Tabs
                      selectedKey={selectedTab}
                      onSelectionChange={key => {
                        setTab(key as OauthProviderName);
                      }}
                      aria-label='Git repository settings tabs'
                      className="flex-1 w-full h-full flex flex-col px-10"
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
                          // uri={projectData.uri}
                          onSubmit={onGitRepoFormSubmit}
                        />
                      </TabPanel>
                      <TabPanel className='w-full h-full overflow-y-auto py-2' id='gitlab'>
                        <GitLabRepositorySetupFormGroup
                          // uri={projectData.uri}
                          onSubmit={onGitRepoFormSubmit}
                        />
                      </TabPanel>
                      <TabPanel className='w-full h-full overflow-y-auto py-2' id='custom'>
                        <CustomRepositorySettingsFormGroup
                          // gitRepository={{
                          //   author: {
                          //     email: projectData.authorEmail,
                          //     name: projectData.authorName,
                          //   },
                          //   credentials: {
                          //     token: projectData.token,
                          //     username: projectData.username,
                          //   },
                          //   uri: projectData.uri,
                          // }}
                          onSubmit={onGitRepoFormSubmit}
                        />
                      </TabPanel>
                    </Tabs>
                  </ErrorBoundary>
                  <div className='flex items-center justify-end gap-2 px-10 pb-10'>
                    <Button
                      onPress={() => setActiveView('project')}
                      className="hover:no-underline hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
                    >
                      Back
                    </Button>
                    <Button
                      type='submit'
                      form={selectedTab}
                      className="hover:no-underline w-[10ch] text-center bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
                    >
                      Clone
                    </Button>
                  </div>
                </>
              )}

              {activeView === 'git-results' && (
                <>
                  {initCloneGitRepositoryFetcher.state === 'submitting' && (
                    <div className='w-full flex flex-col gap-2 p-4 items-center justify-center'>
                      <InsomniaLogo loading className='w-12 h-12' />
                      Loading Insomnia files from repository
                    </div>
                  )}
                  {insomniaFiles.length === 0 && initCloneGitRepositoryFetcher.state === 'idle' && (
                    <div className='w-full flex flex-col gap-2 p-4 items-center justify-center px-10'>
                      <div className="flex w-full items-center px-4 py-1 gap-2 text-sm rounded-sm text-[--color-font-success] bg-[--hl-xs]">
                        <span className='flex items-center justify-center relative'>
                          <InsomniaLogo className='w-12 h-12 grayscale opacity-45' />
                        </span>
                        <p className='max-w-lg p-2 rounded-sm'>Clone this repository to start a new project. Add your collections, documents, environments, and mock servers, and share them using Git.</p>
                      </div>
                    </div>
                  )}
                  {insomniaFiles.length > 0 && (
                    <div className='px-10 flex flex-col gap-2'>
                      <Heading className='text-base'>Insomnia files that will be imported:</Heading>
                      <div className='rounded w-full border border-solid border-[--hl-sm] select-none overflow-x-hidden overflow-y-auto max-h-96'>
                        <Table
                          selectionMode='none'
                          aria-label='Insomnia files'
                          className="border-separate border-spacing-0 w-full table-fixed"
                        >
                          <TableHeader>
                            <Column isRowHeader className="sticky px-2 py-2 top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                              Name
                            </Column>
                            <Column className="sticky px-2 py-2 top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                              Type
                            </Column>
                            <Column className="sticky px-2 py-2 top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                              File path
                            </Column>
                          </TableHeader>
                          <TableBody
                            className="divide divide-[--hl-sm] divide-solid"
                            items={insomniaFiles.map(file => ({ id: file.path, ...file }))}
                          >
                            {file => (
                              <Row className="group focus:outline-none focus-within:bg-[--hl-xxs] transition-colors">
                                <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                                  <div className='flex items-center gap-2 py-2 px-2'>
                                    <span className={`${scopeToBgColorMap[file.scope]} ${scopeToTextColorMap[file.scope]} rounded aspect-square h-6 flex items-center justify-center`}>
                                      <Icon icon={scopeToIconMap[file.scope]} className="w-4" />
                                    </span>
                                    <span className='truncate'>{file.name}</span>
                                  </div>
                                </Cell>
                                <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                                  <span className='flex items-center px-2 text-[--hl] gap-1'>
                                    {scopeToLabelMap[file.scope]}
                                  </span>
                                </Cell>
                                <Cell className="whitespace-nowrap text-sm font-medium border-b border-solid border-[--hl-sm] group-last-of-type:border-none focus:outline-none">
                                  <span className='flex items-center italic gap-1 text-[--hl]'>
                                    <Icon icon="file" className='text-[--hl]' />
                                    <span className='px-2 text-[--hl] truncate'>
                                      {file.path}
                                    </span>
                                  </span>
                                </Cell>
                              </Row>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                  <div className='flex items-center justify-end gap-2 px-10 pb-10'>
                    <Button
                      onPress={() => setActiveView('git-clone')}
                      className="hover:no-underline hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font] transition-colors rounded-sm"
                    >
                      Back
                    </Button>
                    <Button
                      onPress={onCreateProject}
                      className="hover:no-underline w-[10ch] text-center bg-[--color-surprise] hover:bg-opacity-90 border border-solid border-[--hl-md] py-2 px-3 text-[--color-font-surprise] transition-colors rounded-sm"
                    >
                      Clone
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
};

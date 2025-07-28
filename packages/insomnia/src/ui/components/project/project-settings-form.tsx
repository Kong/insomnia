import type { FC } from 'react';
import React, { useEffect, useState } from 'react';
import {
  Button,
  Cell,
  Column,
  Heading,
  Input,
  Label,
  Radio,
  RadioGroup,
  Row,
  Tab,
  Table,
  TableBody,
  TableHeader,
  TabList,
  TabPanel,
  Tabs,
  TextField,
} from 'react-aria-components';
import { useFetcher, useParams } from 'react-router';

import type { OauthProviderName } from '../../../models/git-credentials';
import type { GitRepository } from '../../../models/git-repository';
import {
  getDefaultProjectStorageType,
  getProjectStorageTypeLabel,
  isGitProject,
  isRemoteProject,
  type Project,
} from '../../../models/project';
import type { StorageRules } from '../../organization-utils';
import type { InitGitCloneResult } from '../../routes/$organizationId.git';
import {
  scopeToBgColorMap,
  scopeToIconMap,
  scopeToLabelMap,
  scopeToTextColorMap,
} from '../../routes/$organizationId.project.$projectId';
import type { UpdateProjectActionResult } from '../../routes/$organizationId.project.$projectId.update';
import { ErrorBoundary } from '../error-boundary';
import { CustomRepositorySettingsFormGroup } from '../git-credentials/custom-repository-settings-form';
import { GitHubRepositorySetupFormGroup } from '../git-credentials/github-repository-settings-form';
import { GitLabRepositorySetupFormGroup } from '../git-credentials/gitlab-repository-settings-form';
import { Icon } from '../icon';
import { InsomniaLogo } from '../insomnia-icon';

function isSwitchingStorageType(project: Project, storageType: 'local' | 'remote' | 'git') {
  if (storageType === 'git' && !isGitProject(project)) {
    return true;
  }

  if (storageType === 'local' && (isRemoteProject(project) || isGitProject(project))) {
    return true;
  }

  if (storageType === 'remote' && !isRemoteProject(project)) {
    return true;
  }

  return false;
}

interface Props {
  storageRules: StorageRules;
  isGitSyncEnabled: boolean;
  project?: Project;
  gitRepository?: GitRepository;
  defaultProjectName?: string;
  onCancel?(): void;
  onSuccessUpdate?(): void;
}

export const ProjectSettingsForm: FC<Props> = ({
  storageRules,
  isGitSyncEnabled,
  project,
  gitRepository,
  defaultProjectName = 'My Project',
  onCancel,
  onSuccessUpdate,
}) => {
  const { organizationId } = useParams() as { organizationId: string };

  const [storageType, setStorageType] = useState<'local' | 'remote' | 'git'>(
    getDefaultProjectStorageType(storageRules, project),
  );
  const [activeView, setActiveView] = useState<'project' | 'git-clone' | 'git-results' | 'switch-storage-type'>(
    'project',
  );
  const [selectedTab, setTab] = useState<OauthProviderName>('github');
  const [error, setError] = useState<string | null>(null);

  const [projectData, setProjectData] = useState<{
    name: string;
    authorName?: string;
    authorEmail?: string;
    uri?: string;
    ref?: string;
    username?: string;
    password?: string;
    token?: string;
    oauth2format?: OauthProviderName;
  }>({
    name: project?.name || defaultProjectName,
    authorName: gitRepository?.author?.name || '',
    authorEmail: gitRepository?.author?.email || '',
    uri: gitRepository?.uri || '',
    username: gitRepository?.credentials?.username || '',
    password:
      gitRepository?.credentials && 'password' in gitRepository.credentials ? gitRepository?.credentials?.password : '',
    token: gitRepository?.credentials && 'token' in gitRepository.credentials ? gitRepository?.credentials?.token : '',
    oauth2format:
      gitRepository?.credentials && 'oauth2format' in gitRepository.credentials
        ? (gitRepository?.credentials?.oauth2format ?? 'github')
        : undefined,
  });

  const initCloneGitRepositoryFetcher = useFetcher<InitGitCloneResult>();
  const upsertProjectFetcher = useFetcher<UpdateProjectActionResult>();

  const showStorageRestrictionMessage =
    !storageRules.enableCloudSync || !storageRules.enableLocalVault || !storageRules.enableGitSync;
  const insomniaFiles =
    initCloneGitRepositoryFetcher.data && 'files' in initCloneGitRepositoryFetcher.data
      ? initCloneGitRepositoryFetcher.data.files
      : [];

  useEffect(() => {
    if (upsertProjectFetcher.data && upsertProjectFetcher.data.success && onSuccessUpdate) {
      onSuccessUpdate();
    }
  }, [onSuccessUpdate, upsertProjectFetcher.data]);

  useEffect(() => {
    if (upsertProjectFetcher.state === 'idle' && upsertProjectFetcher.data && upsertProjectFetcher.data?.error) {
      setError(upsertProjectFetcher.data.error);
    }
  }, [upsertProjectFetcher.data, upsertProjectFetcher.state]);

  useEffect(() => {
    if (storageRules) {
      setStorageType(getDefaultProjectStorageType(storageRules, project));
    }
  }, [storageRules, project]);

  const onGitRepoFormSubmit = (gitRepositoryPatch: Partial<GitRepository & { ref?: string }>) => {
    const { author, credentials, created, modified, isPrivate, needsFullClone, uriNeedsMigration, ...repoPatch } =
      gitRepositoryPatch;

    setProjectData({
      ...projectData,
      ...credentials,
      authorName: author?.name || '',
      authorEmail: author?.email || '',
      uri: repoPatch.uri,
      ref: repoPatch.ref,
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
      },
    );

    setActiveView('git-results');
  };

  const onUpsertProject = () => {
    if (project && activeView !== 'switch-storage-type' && isSwitchingStorageType(project, storageType)) {
      setActiveView('switch-storage-type');
      return;
    }

    const action = project
      ? `/organization/${organizationId}/project/${project._id}/update`
      : `/organization/${organizationId}/project/new`;

    upsertProjectFetcher.submit(
      {
        ...projectData,
        storageType,
      },
      {
        action,
        method: 'POST',
        encType: 'application/json',
      },
    );
  };

  return (
    <div className="flex w-full max-w-[600px] flex-col gap-4">
      {error && (
        <div className="flex items-center gap-2 rounded-sm bg-[rgba(var(--color-danger-rgb),0.5)] px-2 py-1 text-sm text-[--color-font-danger]">
          <Icon icon="triangle-exclamation" />
          <span>{error}</span>
        </div>
      )}

      {activeView === 'project' && (
        <>
          <div className="mt-4 flex w-full flex-col justify-start gap-8 overflow-y-auto pb-2 text-left">
            <TextField
              autoFocus
              name="name"
              value={projectData.name}
              onChange={name => setProjectData({ ...projectData, name })}
              className="group relative flex flex-col gap-2 px-0.5"
            >
              <Label className="text-sm text-[--hl]">Project name</Label>
              <Input
                placeholder="My project"
                className="w-full rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] py-1 pl-2 pr-7 text-[--color-font] transition-colors placeholder:italic focus:outline-none focus:ring-1 focus:ring-[--hl-md]"
              />
            </TextField>
            <RadioGroup
              name="type"
              className="flex flex-col gap-2 px-0.5"
              onChange={value => {
                error && setError(null);
                setStorageType(value as 'local' | 'remote' | 'git');
              }}
              value={storageType}
            >
              <Label className="text-sm text-[--hl]">Project type</Label>
              <div className="flex gap-2">
                <Radio
                  isDisabled={!storageRules.enableLocalVault}
                  value="local"
                  className="flex-1 rounded border border-solid border-[--hl-md] p-4 transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:outline-none data-[selected]:border-[--color-surprise] data-[disabled]:opacity-25 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise]"
                >
                  <div className="flex items-center gap-2">
                    <Icon icon="laptop" />
                    <Heading className="text-lg font-bold">Local Vault</Heading>
                  </div>
                  <p className="pt-2">Stored locally only, with no cloud. Ideal when collaboration is not needed.</p>
                </Radio>

                <Radio
                  isDisabled={!storageRules.enableCloudSync}
                  value="remote"
                  className="flex-1 rounded border border-solid border-[--hl-md] p-4 transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:outline-none data-[selected]:border-[--color-surprise] data-[disabled]:opacity-25 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise]"
                >
                  <div className="flex items-center gap-2">
                    <Icon icon="globe" />
                    <Heading className="text-lg font-bold">Cloud Sync</Heading>
                  </div>
                  <p className="pt-2">
                    Encrypted and synced securely to the cloud, ideal for out of the box collaboration.
                  </p>
                </Radio>
                <Radio
                  isDisabled={!isGitSyncEnabled || !storageRules.enableGitSync}
                  value="git"
                  className="flex-1 rounded border border-solid border-[--hl-md] p-4 transition-colors hover:bg-[--hl-xs] focus:bg-[--hl-sm] focus:outline-none data-[selected]:border-[--color-surprise] data-[disabled]:opacity-25 data-[selected]:ring-2 data-[selected]:ring-[--color-surprise]"
                >
                  <div className="flex items-center gap-2">
                    <Icon icon={['fab', 'git-alt']} />
                    <Heading className="text-lg font-bold">Git Sync</Heading>
                  </div>
                  <p className="pt-2">
                    Stored locally and synced to a Git repository. Ideal for version control and collaboration.
                  </p>
                </Radio>
              </div>
            </RadioGroup>
            {showStorageRestrictionMessage && (
              <div className="flex items-center gap-2 rounded-sm bg-[rgba(var(--color-warning-rgb),0.5)] px-2 py-1 text-sm text-[--color-font-warning]">
                <Icon icon="triangle-exclamation" />
                <span>
                  The organization owner mandates that projects must be created and stored using{' '}
                  {getProjectStorageTypeLabel(storageRules)}.
                </span>
              </div>
            )}
          </div>
          <div className="mt-4 flex w-full items-center justify-end gap-2 px-0.5 pb-10">
            <div className="flex items-center gap-2">
              {onCancel && (
                <Button
                  onPress={onCancel}
                  className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-[--hl-md] px-4 py-2 text-sm text-[--color-font] transition-colors hover:bg-[--hl-xs] aria-pressed:bg-[--hl-xs]"
                >
                  Cancel
                </Button>
              )}
              {storageType === 'git' && (
                <Button
                  onPress={() => setActiveView('git-clone')}
                  className="flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid border-[--hl-md] bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] bg-opacity-100 px-4 py-2 text-sm font-semibold text-[--color-font-surprise] ring-1 ring-transparent transition-all hover:bg-opacity-80 focus:ring-inset focus:ring-[--hl-md] aria-pressed:opacity-80"
                >
                  Next
                </Button>
              )}
              {storageType !== 'git' && (
                <Button
                  onPress={onUpsertProject}
                  isDisabled={upsertProjectFetcher.state !== 'idle'}
                  className="flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid border-[--hl-md] bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] bg-opacity-100 px-4 py-2 text-sm font-semibold text-[--color-font-surprise] ring-1 ring-transparent transition-all hover:bg-opacity-80 focus:ring-inset focus:ring-[--hl-md] aria-pressed:opacity-80"
                >
                  {upsertProjectFetcher.state !== 'idle' && <Icon icon="spinner" className="animate-spin" />}
                  <span>{project ? 'Update' : 'Create'}</span>
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
              aria-label="Git repository settings tabs"
              className="mt-4 flex h-full w-full flex-col"
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
                <GitHubRepositorySetupFormGroup onSubmit={onGitRepoFormSubmit} />
              </TabPanel>
              <TabPanel className="h-full w-full overflow-y-auto py-2" id="gitlab">
                <GitLabRepositorySetupFormGroup onSubmit={onGitRepoFormSubmit} />
              </TabPanel>
              <TabPanel className="h-full w-full overflow-y-auto py-2" id="custom">
                <CustomRepositorySettingsFormGroup onSubmit={onGitRepoFormSubmit} />
              </TabPanel>
            </Tabs>
          </ErrorBoundary>
          <div className="flex items-center justify-end gap-2 pb-10">
            <Button
              onPress={() => setActiveView('project')}
              className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-[--hl-md] px-4 py-2 text-sm text-[--color-font] transition-colors hover:bg-[--hl-xs] aria-pressed:bg-[--hl-xs]"
            >
              Back
            </Button>
            <Button
              type="submit"
              form={selectedTab}
              className="flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid border-[--hl-md] bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] bg-opacity-100 px-4 py-2 text-sm font-semibold text-[--color-font-surprise] ring-1 ring-transparent transition-all hover:bg-opacity-80 focus:ring-inset focus:ring-[--hl-md] aria-pressed:opacity-80"
            >
              Clone
            </Button>
          </div>
        </>
      )}

      {activeView === 'git-results' && (
        <>
          {initCloneGitRepositoryFetcher.state !== 'idle' && (
            <div className="flex w-full flex-col items-center justify-center gap-2 pt-4">
              <div className="flex w-full flex-col items-center gap-2 rounded-sm bg-[--hl-xs] p-4 text-sm text-[--color-font-success]">
                <span className="relative flex items-center justify-center">
                  <InsomniaLogo className="h-12 w-12" />
                </span>
                <p className="p-2 text-center font-bold text-[--color-font]">Loading Insomnia files from repository</p>
              </div>
            </div>
          )}
          {insomniaFiles.length === 0 && initCloneGitRepositoryFetcher.state === 'idle' && (
            <div className="flex w-full flex-col items-center justify-center gap-2 pt-4">
              <div className="flex w-full flex-col items-center gap-2 rounded-sm bg-[--hl-xs] p-4 text-sm text-[--color-font-success]">
                <span className="relative flex items-center justify-center">
                  <InsomniaLogo className="h-12 w-12" />
                </span>
                <p className="p-2 text-center font-bold text-[--color-font]">
                  We didn't find any Insomnia files in this repository.
                </p>
                <p className="p-2 text-center font-bold text-[--color-font]">
                  Clone this repository to start a new project.
                </p>
                <p className="p-2 text-center text-[--color-font]">
                  Add your collections, documents, environments and mock servers, and share them using Git.
                </p>
              </div>
            </div>
          )}
          {insomniaFiles.length > 0 && (
            <div className="flex flex-col gap-2">
              <Heading className="text-base">We found {insomniaFiles.length} Insomnia files in your repository</Heading>
              <div className="max-h-96 w-full select-none overflow-y-auto overflow-x-hidden rounded border border-solid border-[--hl-sm]">
                <Table
                  selectionMode="none"
                  aria-label="Insomnia files"
                  className="w-full table-fixed border-separate border-spacing-0"
                >
                  <TableHeader>
                    <Column
                      isRowHeader
                      className="sticky top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] px-2 py-2 text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none"
                    >
                      Name
                    </Column>
                    <Column className="sticky top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] px-2 py-2 text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                      Type
                    </Column>
                    <Column className="sticky top-0 z-10 border-b border-[--hl-sm] bg-[--hl-xs] px-2 py-2 text-left text-xs font-semibold backdrop-blur backdrop-filter focus:outline-none">
                      File path
                    </Column>
                  </TableHeader>
                  <TableBody
                    className="divide divide-solid divide-[--hl-sm]"
                    items={insomniaFiles.map(file => ({ id: file.path, ...file }))}
                  >
                    {file => (
                      <Row className="group transition-colors focus-within:bg-[--hl-xxs] focus:outline-none">
                        <Cell className="whitespace-nowrap border-b border-solid border-[--hl-sm] text-sm font-medium focus:outline-none group-last-of-type:border-none">
                          <div className="flex items-center gap-2 px-2 py-2">
                            <span
                              className={`${scopeToBgColorMap[file.scope]} ${scopeToTextColorMap[file.scope]} flex aspect-square h-6 items-center justify-center rounded`}
                            >
                              <Icon icon={scopeToIconMap[file.scope]} className="w-4" />
                            </span>
                            <span className="truncate">{file.name}</span>
                            {file.path === '.insomnia' && (
                              <span className="flex items-center gap-2 text-[--color-warning]">
                                <Icon icon="triangle-exclamation" />
                              </span>
                            )}
                          </div>
                        </Cell>
                        <Cell className="whitespace-nowrap border-b border-solid border-[--hl-sm] text-sm font-medium focus:outline-none group-last-of-type:border-none">
                          <span className="flex items-center gap-1 px-2 text-[--hl]">
                            {scopeToLabelMap[file.scope]}
                          </span>
                        </Cell>
                        <Cell className="whitespace-nowrap border-b border-solid border-[--hl-sm] text-sm font-medium focus:outline-none group-last-of-type:border-none">
                          <span className="flex items-center gap-1 italic text-[--hl]">
                            <Icon icon={file.path === '.insomnia' ? 'folder' : 'file'} className="text-[--hl]" />
                            <span className="truncate px-2 text-[--hl]">{file.path}</span>
                          </span>
                        </Cell>
                      </Row>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          {insomniaFiles.some(file => file.path === '.insomnia') && (
            <div className="rounded-sm bg-[rgba(var(--color-warning-rgb),var(--tw-bg-opacity))] bg-opacity-50 p-[--padding-sm] text-[--color-font-warning]">
              <Heading className="flex items-center gap-2 text-lg font-bold">
                <Icon icon="triangle-exclamation" className="text-[--color-font-warning]" />
                We found legacy Insomnia files in your repository
              </Heading>
              <p className="pt-2">
                This Git repository contains legacy Insomnia git files. These will be imported and migrated to the new
                format supported in Insomnia 11+.
              </p>
              <p className="pt-2">
                By migrating these <strong>a new commit will be created</strong> which once synced will result in any
                users on older versions of Insomnia no longer being able to access these collections.
              </p>
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pb-10">
            <Button
              isDisabled={upsertProjectFetcher.state !== 'idle'}
              onPress={() => {
                setTab('github');
                setActiveView('git-clone');
              }}
              className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-[--hl-md] px-4 py-2 text-sm text-[--color-font] transition-colors hover:bg-[--hl-xs] aria-pressed:bg-[--hl-xs]"
            >
              Back
            </Button>
            <Button
              isDisabled={upsertProjectFetcher.state !== 'idle'}
              onPress={onUpsertProject}
              className="flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid border-[--hl-md] bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] bg-opacity-100 px-4 py-2 text-sm font-semibold text-[--color-font-surprise] ring-1 ring-transparent transition-all hover:bg-opacity-80 focus:ring-inset focus:ring-[--hl-md] aria-pressed:opacity-80"
            >
              {upsertProjectFetcher.state !== 'idle' ? (
                <>
                  <Icon icon="spinner" className="animate-spin" />
                  <span>Cloning</span>
                </>
              ) : (
                <>
                  <span>{insomniaFiles.length > 0 ? 'Import all' : 'Clone'}</span>
                </>
              )}
            </Button>
          </div>
        </>
      )}

      {activeView === 'switch-storage-type' && (
        <>
          <div className="flex flex-col justify-start gap-2 overflow-y-auto px-10">
            {storageType === 'git' && (
              <div className="flex flex-col gap-4 text-[--color-font]">
                <div className="flex flex-col gap-4">
                  <p>
                    {project && isRemoteProject(project)
                      ? 'We will be converting your Cloud Sync project into a Git project, and permanently remove all cloud data for this project from the cloud.'
                      : 'We will be converting your project into a Git project.'}
                  </p>
                  <ul className="flex flex-col gap-2 text-left">
                    <li>
                      <i className="fa fa-check text-emerald-600" /> The project will be 100% stored locally.
                    </li>
                    <li>
                      <i className="fa fa-check text-emerald-600" /> Your collaborators can synchronize files using Git.
                    </li>
                    <li>
                      <i className="fa fa-check text-emerald-600" /> The project will be stored locally also for every
                      existing collaborator.
                    </li>
                  </ul>
                  <p>You can synchronize a local project back to the cloud if you decide to do so.</p>
                  {project && isRemoteProject(project) && (
                    <p className="flex items-center gap-2">
                      <Icon icon="triangle-exclamation" className="text-[--color-warning]" />
                      Remember to pull your latest project updates before this operation
                    </p>
                  )}
                </div>
              </div>
            )}
            {storageType === 'local' && (
              <div className="flex flex-col gap-4 text-[--color-font]">
                <div className="flex flex-col gap-4">
                  <p>
                    {project && isGitProject(project)
                      ? 'We will be converting your Git project into a local project.'
                      : 'We will be converting your Cloud Sync project into a local project, and permanently remove all cloud data for this project from the cloud.'}
                  </p>
                  {project && isGitProject(project) && (
                    <ul className="flex flex-col gap-2 text-left">
                      <li>
                        <i className="fa fa-check text-emerald-600" /> The project will be 100% stored locally.
                      </li>
                      <li>
                        <i className="fa fa-check text-emerald-600" /> You will not be able to synchronize this project
                        using Git anymore.
                      </li>
                      <li>
                        <i className="fa fa-check text-emerald-600" /> This action will not delete your remote
                        repository.
                      </li>
                    </ul>
                  )}
                  {project && isRemoteProject(project) && (
                    <>
                      <ul className="flex flex-col gap-2 text-left">
                        <li>
                          <i className="fa fa-check text-emerald-600" /> The project will be 100% stored locally.
                        </li>
                        <li>
                          <i className="fa fa-check text-emerald-600" /> Your collaborators will not be able to push and
                          pull files anymore.
                        </li>
                        <li>
                          <i className="fa fa-check text-emerald-600" /> The project will become local also for every
                          existing collaborator.
                        </li>
                      </ul>
                      <p>
                        You can still use Git Sync for local projects without using the cloud, and you can synchronize a
                        local project back to the cloud if you decide to do so.
                      </p>
                    </>
                  )}
                  <p className="flex items-center gap-2">
                    <Icon icon="triangle-exclamation" className="text-[--color-warning]" />
                    Remember to pull your latest project updates before this operation
                  </p>
                </div>
              </div>
            )}
            {storageType === 'remote' && (
              <div className="flex flex-col gap-4 text-[--color-font]">
                <div className="flex flex-col gap-4">
                  <p>
                    We will be synchronizing your local project to Insomnia's Cloud in a secure encrypted format which
                    will enable cloud collaboration.
                  </p>
                  <ul className="flex flex-col gap-2 text-left">
                    <li>
                      <i className="fa fa-check text-emerald-600" /> Your data in the cloud is encrypted and secure.
                    </li>
                    <li>
                      <i className="fa fa-check text-emerald-600" /> You can now collaborate with any amount of users
                      and use cloud features.
                    </li>
                    <li>
                      <i className="fa fa-check text-emerald-600" /> Your project will be always available on any client
                      after logging in.
                    </li>
                  </ul>
                  <p>You can still use Git Sync for cloud projects.</p>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-end gap-2 px-10 pb-10">
            <div className="flex items-center gap-2">
              <Button
                onPress={() => setActiveView('project')}
                className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-[--hl-md] px-4 py-2 text-sm text-[--color-font] transition-colors hover:bg-[--hl-xs] aria-pressed:bg-[--hl-xs]"
              >
                Back
              </Button>
              <Button
                onPress={onUpsertProject}
                isDisabled={upsertProjectFetcher.state !== 'idle'}
                className="flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid border-[--hl-md] bg-[rgba(var(--color-surprise-rgb),var(--tw-bg-opacity))] bg-opacity-100 px-4 py-2 text-sm font-semibold text-[--color-font-surprise] ring-1 ring-transparent transition-all hover:bg-opacity-80 focus:ring-inset focus:ring-[--hl-md] aria-pressed:opacity-80"
              >
                {upsertProjectFetcher.state !== 'idle' && <Icon icon="spinner" className="animate-spin" />}
                <span>Update</span>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

import classNames from 'classnames';
import type { FC } from 'react';
import React, { useEffect, useState } from 'react';
import {
  Button,
  Cell,
  Checkbox,
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
import { useParams } from 'react-router';

import { getAppWebsiteBaseURL } from '~/common/constants';
import { docsPricingLearnMoreLink } from '~/common/documentation';
import { isGitCredentialsOAuth } from '~/models/git-repository';
import { isOwnerOfOrganization, type StorageRules } from '~/models/organization';
import { useRootLoaderData } from '~/root';
import { useGitProjectInitCloneActionFetcher } from '~/routes/git.init-clone';
import { useOrganizationLoaderData } from '~/routes/organization';
import {
  fallbackFeatures,
  useOrganizationPermissionsLoaderFetcher,
} from '~/routes/organization.$organizationId.permissions';
import { useProjectNewActionFetcher } from '~/routes/organization.$organizationId.project.new';
import { useIsLightTheme } from '~/ui/hooks/theme';
import { useLoaderDeferData } from '~/ui/hooks/use-loader-defer-data';

import type { OauthProviderName } from '../../../models/git-credentials';
import type { GitRepository } from '../../../models/git-repository';
import {
  getDefaultProjectStorageType,
  getProjectStorageTypeLabel,
  isGitProject,
  isRemoteProject,
  type Project,
} from '../../../models/project';
import {
  scopeToBgColorMap,
  scopeToIconMap,
  scopeToLabelMap,
  scopeToTextColorMap,
} from '../../../routes/organization.$organizationId.project.$projectId._index';
import { useProjectUpdateActionFetcher } from '../../../routes/organization.$organizationId.project.$projectId.update';
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

  const permissionsFetcher = useOrganizationPermissionsLoaderFetcher({ key: `permissions:${organizationId}` });
  const permissionsFetcherLoad = permissionsFetcher.load;
  useEffect(() => {
    permissionsFetcherLoad({
      organizationId,
    });
  }, [organizationId, permissionsFetcherLoad]);
  const { featuresPromise } = permissionsFetcher.data || {};
  const [features = fallbackFeatures] = useLoaderDeferData(featuresPromise, organizationId);
  isGitSyncEnabled = features.gitSync.enabled;

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
    connectRepositoryLater?: boolean;
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
    connectRepositoryLater: false,
  });

  const initCloneGitRepositoryFetcher = useGitProjectInitCloneActionFetcher();
  const updateProjectFetcher = useProjectUpdateActionFetcher();
  const newProjectFetcher = useProjectNewActionFetcher();

  const showStorageRestrictionMessage =
    !storageRules.enableCloudSync || !storageRules.enableLocalVault || !storageRules.enableGitSync;
  const insomniaFiles =
    initCloneGitRepositoryFetcher.data && 'files' in initCloneGitRepositoryFetcher.data
      ? initCloneGitRepositoryFetcher.data.files
      : [];

  useEffect(() => {
    if (updateProjectFetcher.data && updateProjectFetcher.data.success && onSuccessUpdate) {
      onSuccessUpdate();
    }
  }, [onSuccessUpdate, updateProjectFetcher.data]);

  useEffect(() => {
    if (newProjectFetcher.state === 'idle' && newProjectFetcher.data && newProjectFetcher.data?.error) {
      setError(newProjectFetcher.data.error);
    }
  }, [newProjectFetcher.data, newProjectFetcher.state]);

  useEffect(() => {
    if (updateProjectFetcher.state === 'idle' && updateProjectFetcher.data && updateProjectFetcher.data?.error) {
      setError(updateProjectFetcher.data.error);
    }
  }, [updateProjectFetcher.data, updateProjectFetcher.state]);

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

    initCloneGitRepositoryFetcher.submit({
      ...repoPatch,
      authorName: author?.name || '',
      authorEmail: author?.email || '',
      ...(credentials
        ? isGitCredentialsOAuth(credentials)
          ? {
              credentials: {
                token: credentials.token || '',
                oauth2format: credentials.oauth2format || 'github',
                username: credentials.username || '',
              },
            }
          : {
              credentials,
            }
        : {
            credentials: {
              password: '',
              username: '',
            },
          }),
      uri: repoPatch.uri || '',
      organizationId,
    });

    setActiveView('git-results');
  };

  const onUpsertProject = () => {
    if (project && activeView !== 'switch-storage-type' && isSwitchingStorageType(project, storageType)) {
      setActiveView('switch-storage-type');
      return;
    }

    if (project) {
      updateProjectFetcher.submit({
        organizationId,
        projectId: project._id,
        projectData: {
          ...projectData,
          storageType,
        },
      });
    } else {
      newProjectFetcher.submit({
        organizationId,
        projectData: {
          ...projectData,
          storageType,
        },
      });
    }
  };

  const organizationData = useOrganizationLoaderData();
  const { userSession } = useRootLoaderData()!;
  const organization = organizationData?.organizations.find(o => o.id === organizationId);
  const isUserOwner =
    organization && userSession.accountId && isOwnerOfOrganization({ organization, accountId: userSession.accountId });

  const isLightTheme = useIsLightTheme();

  return (
    <div className="flex w-full max-w-[600px] flex-col gap-4">
      {error && (
        <div className="rounded-xs text-(--color-font-danger) flex items-center gap-2 bg-[rgba(var(--color-danger-rgb),0.5)] px-2 py-1 text-sm">
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
              <Label className="text-(--hl) text-sm">Project name</Label>
              <Input
                placeholder="My project"
                className="rounded-xs border-(--hl-sm) bg-(--color-bg) text-(--color-font) focus:ring-(--hl-md) focus:outline-hidden w-full border border-solid py-1 pl-2 pr-7 transition-colors placeholder:italic focus:ring-1"
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
              <Label className="text-(--hl) text-sm">Project type</Label>
              <div className="flex gap-2">
                <Radio
                  isDisabled={!storageRules.enableLocalVault}
                  value="local"
                  className="border-(--hl-md) hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-disabled:opacity-25 data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise) flex-1 rounded-sm border border-solid p-4 transition-colors"
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
                  className="border-(--hl-md) hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-disabled:opacity-25 data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise) flex-1 rounded-sm border border-solid p-4 transition-colors"
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
                  isDisabled={!storageRules.enableGitSync}
                  value="git"
                  className="border-(--hl-md) hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-disabled:opacity-25 data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise) flex-1 rounded-sm border border-solid p-4 transition-colors"
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
              {storageType === 'git' && !isGitSyncEnabled && (
                <div
                  className={classNames('mt-3 flex items-start justify-start gap-5 rounded-md px-6 py-5', {
                    'bg-[#292535]': !isLightTheme,
                    'bg-[#EEEBFF]': isLightTheme,
                  })}
                >
                  <Icon icon="circle-info" className="pt-1.5" />
                  <div className="flex flex-col items-start justify-start gap-3.5">
                    <Heading className="text-lg font-bold">
                      Git Sync limited to organizations of 3 or fewer users
                    </Heading>
                    {isUserOwner ? (
                      <>
                        <p>
                          Git Sync is included on your plan for up to 3 users. Since your team is larger, you’ll need to
                          upgrade your plan to use it.{' '}
                          <a href={docsPricingLearnMoreLink} className="underline">
                            Learn more ↗
                          </a>
                        </p>
                        <a
                          href={getAppWebsiteBaseURL() + '/app/pricing?source=app_create_git_project'}
                          className="rounded-xs border-(--hl-md) text-(--color-font) border border-solid px-3 py-2 transition-colors hover:no-underline"
                        >
                          Upgrade
                        </a>
                      </>
                    ) : (
                      <>
                        <p>
                          Git Sync is included on your plan for up to 3 users. Because your team is larger, your admin
                          will need to upgrade the plan for you to access it.
                        </p>
                        <a
                          href={docsPricingLearnMoreLink}
                          className="rounded-xs border-(--hl-md) text-(--color-font) border border-solid px-3 py-2 transition-colors hover:no-underline"
                        >
                          Learn More ↗
                        </a>
                      </>
                    )}
                  </div>
                </div>
              )}
            </RadioGroup>
            {showStorageRestrictionMessage && (
              <div className="rounded-xs text-(--color-font-warning) flex items-center gap-2 bg-[rgba(var(--color-warning-rgb),0.5)] px-2 py-1 text-sm">
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
                  className="border-(--hl-md) text-(--color-font) hover:bg-(--hl-xs) aria-pressed:bg-(--hl-xs) flex h-full items-center justify-center gap-2 rounded-md border border-solid px-4 py-2 text-sm transition-colors"
                >
                  Cancel
                </Button>
              )}
              {storageType === 'git' && (
                <Button
                  isDisabled={!isGitSyncEnabled}
                  onPress={() => setActiveView('git-clone')}
                  className="border-(--hl-md) bg-(--color-surprise) text-(--color-font-surprise) hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid px-4 py-2 text-sm font-semibold ring-1 ring-transparent transition-all focus:ring-inset aria-pressed:opacity-80"
                >
                  Next
                </Button>
              )}
              {storageType !== 'git' && (
                <Button
                  onPress={onUpsertProject}
                  isDisabled={updateProjectFetcher.state !== 'idle' || newProjectFetcher.state !== 'idle'}
                  className="border-(--hl-md) bg-(--color-surprise) text-(--color-font-surprise) hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid px-4 py-2 text-sm font-semibold ring-1 ring-transparent transition-all focus:ring-inset aria-pressed:opacity-80"
                >
                  {(updateProjectFetcher.state !== 'idle' || newProjectFetcher.state !== 'idle') && (
                    <Icon icon="spinner" className="animate-spin" />
                  )}
                  <span>{project ? 'Update' : 'Create'}</span>
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {activeView === 'git-clone' && (
        <>
          <Label className="flex items-center gap-2">
            <Checkbox
              slot={null}
              isSelected={projectData.connectRepositoryLater}
              onChange={isSelected => setProjectData(prev => ({ ...prev, connectRepositoryLater: isSelected }))}
              className="group flex h-full items-center p-0"
            >
              <div className="ring-(--hl-sm) group-data-selected:bg-(--hl-xs) flex h-4 w-4 items-center justify-center rounded-sm ring-1 transition-colors group-focus:ring-2">
                <Icon
                  icon="check"
                  className="group-data-indeterminate:opacity-100 group-data-selected:text-(--color-success) group-data-selected:opacity-100 h-3 w-3 opacity-0"
                />
              </div>
            </Checkbox>
            <span className="text-(--hl) text-sm">Connect repository later</span>
          </Label>
          {project && !gitRepository && projectData.connectRepositoryLater ? (
            <div className="rounded-xs border-(--hl-sm) flex h-full w-full flex-col items-center justify-center border border-dashed p-4">
              <Icon icon="link" className="text-(--hl) mb-4 text-[30px]" />
              <Heading className="text-(--hl) text-lg font-bold">Your project is already set up to start.</Heading>
              <p className="text-(--hl) text-sm">
                Want to connect a repository now? You can uncheck “Connect repository later” to do so.
              </p>
            </div>
          ) : projectData.connectRepositoryLater ? (
            <div className="rounded-xs border-(--hl-sm) flex h-full w-full flex-col items-center justify-center border border-dashed p-4">
              <Icon icon="link" className="text-(--hl) mb-4 text-[30px]" />
              <Heading className="text-(--hl) text-lg font-bold">You're all set to start your project.</Heading>
              <p className="text-(--hl) text-sm">You can connect a repository anytime from the project settings.</p>
            </div>
          ) : (
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
                  className="h-(--line-height-sm) border-b-(--hl-md) bg-(--color-bg) flex w-full shrink-0 items-center overflow-x-auto border-b border-solid"
                  aria-label="Request pane tabs"
                >
                  <Tab
                    className="text-(--hl) outline-hidden hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm) flex h-full shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 transition-colors duration-300"
                    id="github"
                  >
                    <div className="flex items-center gap-2">
                      <i className="fa fa-github" /> GitHub
                    </div>
                  </Tab>
                  <Tab
                    className="text-(--hl) outline-hidden hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm) flex h-full shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 transition-colors duration-300"
                    id="gitlab"
                  >
                    <div className="flex items-center gap-2">
                      <i className="fa fa-gitlab" /> GitLab
                    </div>
                  </Tab>
                  <Tab
                    className="text-(--hl) outline-hidden hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm) flex h-full shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 transition-colors duration-300"
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
          )}
          <div className="flex w-full items-center justify-end gap-2 pb-10">
            <div className="flex items-center gap-2">
              <Button
                onPress={() => {
                  setError(null);
                  setActiveView('project');
                }}
                className="border-(--hl-md) text-(--color-font) hover:bg-(--hl-xs) aria-pressed:bg-(--hl-xs) flex h-full items-center justify-center gap-2 rounded-md border border-solid px-4 py-2 text-sm transition-colors"
              >
                Back
              </Button>
              {!projectData.connectRepositoryLater ? (
                <Button
                  type="submit"
                  form={selectedTab}
                  className="border-(--hl-md) bg-(--color-surprise) text-(--color-font-surprise) hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid px-4 py-2 text-sm font-semibold ring-1 ring-transparent transition-all focus:ring-inset aria-pressed:opacity-80"
                >
                  Clone
                </Button>
              ) : project && projectData.connectRepositoryLater && !gitRepository ? (
                <Button
                  onPress={onCancel}
                  className="border-(--hl-md) bg-(--color-surprise) text-(--color-font-surprise) hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid px-4 py-2 text-sm font-semibold ring-1 ring-transparent transition-all focus:ring-inset aria-pressed:opacity-80"
                >
                  Close
                </Button>
              ) : (
                <Button
                  onPress={onUpsertProject}
                  className="border-(--hl-md) bg-(--color-surprise) text-(--color-font-surprise) hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid px-4 py-2 text-sm font-semibold ring-1 ring-transparent transition-all focus:ring-inset aria-pressed:opacity-80"
                >
                  {project ? 'Update' : 'Create'}
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {activeView === 'git-results' && (
        <>
          {initCloneGitRepositoryFetcher.state !== 'idle' && (
            <div className="flex w-full flex-col items-center justify-center gap-2 pt-4">
              <div className="rounded-xs bg-(--hl-xs) text-(--color-font-success) flex w-full flex-col items-center gap-2 p-4 text-sm">
                <span className="relative flex items-center justify-center">
                  <InsomniaLogo className="h-12 w-12" />
                </span>
                <p className="text-(--color-font) p-2 text-center font-bold">Loading Insomnia files from repository</p>
              </div>
            </div>
          )}
          {insomniaFiles?.length === 0 && initCloneGitRepositoryFetcher.state === 'idle' && (
            <div className="flex w-full flex-col items-center justify-center gap-2 pt-4">
              <div className="rounded-xs bg-(--hl-xs) text-(--color-font-success) flex w-full flex-col items-center gap-2 p-4 text-sm">
                <span className="relative flex items-center justify-center">
                  <InsomniaLogo className="h-12 w-12" />
                </span>
                <p className="text-(--color-font) p-2 text-center font-bold">
                  We didn't find any Insomnia files in this repository.
                </p>
                <p className="text-(--color-font) p-2 text-center font-bold">
                  Clone this repository to start a new project.
                </p>
                <p className="text-(--color-font) p-2 text-center">
                  Add your collections, documents, environments and mock servers, and share them using Git.
                </p>
              </div>
            </div>
          )}
          {insomniaFiles && insomniaFiles?.length > 0 && (
            <div className="flex flex-col gap-2">
              <Heading className="text-base">We found {insomniaFiles.length} Insomnia files in your repository</Heading>
              <div className="border-(--hl-sm) max-h-96 w-full select-none overflow-y-auto overflow-x-hidden rounded-sm border border-solid">
                <Table
                  selectionMode="none"
                  aria-label="Insomnia files"
                  className="w-full table-fixed border-separate border-spacing-0"
                >
                  <TableHeader>
                    <Column
                      isRowHeader
                      className="border-(--hl-sm) bg-(--hl-xs) focus:outline-hidden sticky top-0 z-10 border-b px-2 py-2 text-left text-xs font-semibold backdrop-blur-sm backdrop-filter"
                    >
                      Name
                    </Column>
                    <Column className="border-(--hl-sm) bg-(--hl-xs) focus:outline-hidden sticky top-0 z-10 border-b px-2 py-2 text-left text-xs font-semibold backdrop-blur-sm backdrop-filter">
                      Type
                    </Column>
                    <Column className="border-(--hl-sm) bg-(--hl-xs) focus:outline-hidden sticky top-0 z-10 border-b px-2 py-2 text-left text-xs font-semibold backdrop-blur-sm backdrop-filter">
                      File path
                    </Column>
                  </TableHeader>
                  <TableBody
                    className="divide divide-(--hl-sm) divide-solid"
                    items={insomniaFiles.map(file => ({ id: file.path, ...file }))}
                  >
                    {file => (
                      <Row className="focus-within:bg-(--hl-xxs) focus:outline-hidden group transition-colors">
                        <Cell className="border-(--hl-sm) focus:outline-hidden whitespace-nowrap border-b border-solid text-sm font-medium group-last-of-type:border-none">
                          <div className="flex items-center gap-2 px-2 py-2">
                            <span
                              className={`${scopeToBgColorMap[file.scope]} ${scopeToTextColorMap[file.scope]} flex aspect-square h-6 items-center justify-center rounded-sm`}
                            >
                              <Icon icon={scopeToIconMap[file.scope]} className="w-4" />
                            </span>
                            <span className="truncate">{file.name}</span>
                            {file.path === '.insomnia' && (
                              <span className="text-(--color-warning) flex items-center gap-2">
                                <Icon icon="triangle-exclamation" />
                              </span>
                            )}
                          </div>
                        </Cell>
                        <Cell className="border-(--hl-sm) focus:outline-hidden whitespace-nowrap border-b border-solid text-sm font-medium group-last-of-type:border-none">
                          <span className="text-(--hl) flex items-center gap-1 px-2">
                            {scopeToLabelMap[file.scope]}
                          </span>
                        </Cell>
                        <Cell className="border-(--hl-sm) focus:outline-hidden whitespace-nowrap border-b border-solid text-sm font-medium group-last-of-type:border-none">
                          <span className="text-(--hl) flex items-center gap-1 italic">
                            <Icon icon={file.path === '.insomnia' ? 'folder' : 'file'} className="text-(--hl)" />
                            <span className="text-(--hl) truncate px-2">{file.path}</span>
                          </span>
                        </Cell>
                      </Row>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          {insomniaFiles && insomniaFiles?.some(file => file.path === '.insomnia') && (
            <div className="rounded-xs bg-(--color-warning)/50 p-(--padding-sm) text-(--color-font-warning)">
              <Heading className="flex items-center gap-2 text-lg font-bold">
                <Icon icon="triangle-exclamation" className="text-(--color-font-warning)" />
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
              isDisabled={updateProjectFetcher.state !== 'idle' || newProjectFetcher.state !== 'idle'}
              onPress={() => {
                setActiveView('git-clone');
                setError(null);
              }}
              className="border-(--hl-md) text-(--color-font) hover:bg-(--hl-xs) aria-pressed:bg-(--hl-xs) flex h-full items-center justify-center gap-2 rounded-md border border-solid px-4 py-2 text-sm transition-colors"
            >
              Back
            </Button>
            <Button
              isDisabled={updateProjectFetcher.state !== 'idle' || newProjectFetcher.state !== 'idle'}
              onPress={onUpsertProject}
              className="border-(--hl-md) bg-(--color-surprise) text-(--color-font-surprise) hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid px-4 py-2 text-sm font-semibold ring-1 ring-transparent transition-all focus:ring-inset aria-pressed:opacity-80"
            >
              {updateProjectFetcher.state !== 'idle' || newProjectFetcher.state !== 'idle' ? (
                <>
                  <Icon icon="spinner" className="animate-spin" />
                  <span>Cloning</span>
                </>
              ) : (
                <>
                  <span>{insomniaFiles && insomniaFiles?.length > 0 ? 'Import all' : 'Clone'}</span>
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
              <div className="text-(--color-font) flex flex-col gap-4">
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
                      <Icon icon="triangle-exclamation" className="text-(--color-warning)" />
                      Remember to pull your latest project updates before this operation
                    </p>
                  )}
                </div>
              </div>
            )}
            {storageType === 'local' && (
              <div className="text-(--color-font) flex flex-col gap-4">
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
                    <Icon icon="triangle-exclamation" className="text-(--color-warning)" />
                    Remember to pull your latest project updates before this operation
                  </p>
                </div>
              </div>
            )}
            {storageType === 'remote' && (
              <div className="text-(--color-font) flex flex-col gap-4">
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
                onPress={() => {
                  setError(null);
                  setActiveView('project');
                }}
                className="border-(--hl-md) text-(--color-font) hover:bg-(--hl-xs) aria-pressed:bg-(--hl-xs) flex h-full items-center justify-center gap-2 rounded-md border border-solid px-4 py-2 text-sm transition-colors"
              >
                Back
              </Button>
              <Button
                onPress={onUpsertProject}
                isDisabled={updateProjectFetcher.state !== 'idle' || newProjectFetcher.state !== 'idle'}
                className="border-(--hl-md) bg-(--color-surprise) text-(--color-font-surprise) hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid px-4 py-2 text-sm font-semibold ring-1 ring-transparent transition-all focus:ring-inset aria-pressed:opacity-80"
              >
                {(updateProjectFetcher.state !== 'idle' || newProjectFetcher.state !== 'idle') && (
                  <Icon icon="spinner" className="animate-spin" />
                )}
                <span>Update</span>
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

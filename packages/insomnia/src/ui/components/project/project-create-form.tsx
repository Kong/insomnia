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
import { useActiveView } from '~/ui/components/project/hooks';
import { useIsLightTheme } from '~/ui/hooks/theme';
import { useLoaderDeferData } from '~/ui/hooks/use-loader-defer-data';

import type { OauthProviderName } from '../../../models/git-credentials';
import type { GitRepository } from '../../../models/git-repository';
import {
  getDefaultProjectStorageType,
  getProjectStorageTypeLabel,
  isEmptyGitProject,
  isGitProject,
  isLocalProject,
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

interface Props {
  storageRules: StorageRules;
  isGitSyncEnabled: boolean;
  defaultProjectName?: string;
  onCancel?(): void;
  onSuccessUpdate?(): void;
  activeViewObj?: ReturnType<typeof useActiveView>;
}

export const ProjectCreateForm: FC<Props> = ({
  storageRules,
  isGitSyncEnabled,
  defaultProjectName = 'My Project',
  onCancel,
  onSuccessUpdate,
  activeViewObj,
}) => {
  const { organizationId } = useParams() as { organizationId: string };

  // Reload isGitSyncEnabled everytime this component is mounted
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
    getDefaultProjectStorageType(storageRules),
  );

  let { activeView, setActiveView } = useActiveView();
  if (activeViewObj) {
    activeView = activeViewObj.activeView;
    setActiveView = activeViewObj.setActiveView;
  }

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
    name: defaultProjectName,
    authorName: '',
    authorEmail: '',
    uri: '',
    username: '',
    password: '',
    token: '',
    oauth2format: undefined,
    connectRepositoryLater: false,
  });

  const initCloneGitRepositoryFetcher = useGitProjectInitCloneActionFetcher();
  const newProjectFetcher = useProjectNewActionFetcher();

  const showStorageRestrictionMessage =
    !storageRules.enableCloudSync || !storageRules.enableLocalVault || !storageRules.enableGitSync;
  const insomniaFiles =
    initCloneGitRepositoryFetcher.data && 'files' in initCloneGitRepositoryFetcher.data
      ? initCloneGitRepositoryFetcher.data.files
      : [];

  useEffect(() => {
    if (newProjectFetcher.state === 'idle' && newProjectFetcher.data && newProjectFetcher.data?.error) {
      setError(newProjectFetcher.data.error);
    }
  }, [newProjectFetcher.data, newProjectFetcher.state]);

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
    newProjectFetcher.submit({
      organizationId,
      projectData: {
        ...projectData,
        storageType,
      },
    });
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
        <div className="flex items-center gap-2 rounded-xs bg-[rgba(var(--color-danger-rgb),0.5)] px-2 py-1 text-sm text-(--color-font-danger)">
          <Icon icon="triangle-exclamation" />
          <span>{error}</span>
        </div>
      )}

      {activeView === 'project' && (
        <>
          <div className="mt-4 flex w-full flex-col justify-start gap-8 pb-2 text-left">
            <TextField
              autoFocus
              name="name"
              value={projectData.name}
              onChange={name => setProjectData({ ...projectData, name })}
              className="group relative flex flex-col gap-2 px-0.5"
            >
              <Label className="text-sm text-(--hl)">Project name</Label>
              <Input
                placeholder={defaultProjectName}
                className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
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
              <Label className="text-sm text-(--hl)">Project type</Label>
              <div className="flex gap-2">
                <Radio
                  isDisabled={!storageRules.enableLocalVault}
                  value="local"
                  className="flex-1 rounded-sm border border-solid border-(--hl-md) p-4 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-disabled:opacity-25 data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
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
                  className="flex-1 rounded-sm border border-solid border-(--hl-md) p-4 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-disabled:opacity-25 data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
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
                  className="flex-1 rounded-sm border border-solid border-(--hl-md) p-4 transition-colors hover:bg-(--hl-xs) focus:bg-(--hl-sm) focus:outline-hidden data-disabled:opacity-25 data-selected:border-(--color-surprise) data-selected:ring-2 data-selected:ring-(--color-surprise)"
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
                          className="rounded-xs border border-solid border-(--hl-md) px-3 py-2 text-(--color-font) transition-colors hover:no-underline"
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
                          className="rounded-xs border border-solid border-(--hl-md) px-3 py-2 text-(--color-font) transition-colors hover:no-underline"
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
              <div className="flex items-center gap-2 rounded-xs bg-[rgba(var(--color-warning-rgb),0.5)] px-2 py-1 text-sm text-(--color-font-warning)">
                <Icon icon="triangle-exclamation" />
                <span>
                  The organization owner mandates that projects must be created and stored using{' '}
                  {getProjectStorageTypeLabel(storageRules)}.
                </span>
              </div>
            )}
            {storageType === 'git' && (
              <>
                <Label className="flex items-center gap-2">
                  <Checkbox
                    slot={null}
                    isSelected={projectData.connectRepositoryLater}
                    onChange={isSelected => setProjectData(prev => ({ ...prev, connectRepositoryLater: isSelected }))}
                    className="group flex h-full items-center p-0"
                  >
                    <div className="flex h-4 w-4 items-center justify-center rounded-sm ring-1 ring-(--hl-sm) transition-colors group-focus:ring-2 group-data-selected:bg-(--hl-xs)">
                      <Icon
                        icon="check"
                        className="h-3 w-3 opacity-0 group-data-indeterminate:opacity-100 group-data-selected:text-(--color-success) group-data-selected:opacity-100"
                      />
                    </div>
                  </Checkbox>
                  <span className="text-sm text-(--hl)">Connect repository later</span>
                </Label>
                {!projectData.connectRepositoryLater && (
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
                        className="flex h-(--line-height-sm) w-full shrink-0 items-center overflow-x-auto border-b border-solid border-b-(--hl-md) bg-(--color-bg)"
                        aria-label="Request pane tabs"
                      >
                        <Tab
                          className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
                          id="github"
                        >
                          <div className="flex items-center gap-2">
                            <i className="fa fa-github" /> GitHub
                          </div>
                        </Tab>
                        <Tab
                          className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
                          id="gitlab"
                        >
                          <div className="flex items-center gap-2">
                            <i className="fa fa-gitlab" /> GitLab
                          </div>
                        </Tab>
                        <Tab
                          className="flex h-full shrink-0 cursor-pointer items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 select-none hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
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
              </>
            )}
          </div>
          <div className="mt-4 flex w-full items-center justify-end gap-2 px-0.5 pb-10">
            <div className="flex items-center gap-2">
              {onCancel && (
                <Button
                  onPress={onCancel}
                  className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) px-4 py-2 text-sm text-(--color-font) transition-colors hover:bg-(--hl-xs) aria-pressed:bg-(--hl-xs)"
                >
                  Cancel
                </Button>
              )}
              {storageType !== 'git' || projectData.connectRepositoryLater ? (
                <Button
                  onPress={onUpsertProject}
                  isDisabled={newProjectFetcher.state !== 'idle'}
                  className="flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
                >
                  {newProjectFetcher.state !== 'idle' && <Icon icon="spinner" className="animate-spin" />}
                  <span>Create</span>
                </Button>
              ) : (
                <Button
                  type="submit"
                  form={selectedTab}
                  className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
                >
                  Scan for files
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
              <div className="flex w-full flex-col items-center gap-2 rounded-xs bg-(--hl-xs) p-4 text-sm text-(--color-font-success)">
                <span className="relative flex items-center justify-center">
                  <InsomniaLogo className="h-12 w-12" />
                </span>
                <p className="p-2 text-center font-bold text-(--color-font)">Loading Insomnia files from repository</p>
              </div>
            </div>
          )}
          {insomniaFiles?.length === 0 && initCloneGitRepositoryFetcher.state === 'idle' && (
            <div className="flex w-full flex-col items-center justify-center gap-2 pt-4">
              <div className="flex w-full flex-col items-center gap-2 rounded-xs bg-(--hl-xs) p-4 text-sm text-(--color-font-success)">
                <span className="relative flex items-center justify-center">
                  <InsomniaLogo className="h-12 w-12" />
                </span>
                <p className="p-2 text-center font-bold text-(--color-font)">
                  We didn't find any Insomnia files in this repository.
                </p>
                <p className="p-2 text-center font-bold text-(--color-font)">
                  Clone this repository to start a new project.
                </p>
                <p className="p-2 text-center text-(--color-font)">
                  Add your collections, documents, environments and mock servers, and share them using Git.
                </p>
              </div>
            </div>
          )}
          {insomniaFiles && insomniaFiles?.length > 0 && (
            <div className="flex flex-col gap-2">
              <Heading className="text-base">We found {insomniaFiles.length} Insomnia files in your repository</Heading>

              <div className="max-h-96 w-full overflow-x-hidden overflow-y-auto rounded-sm border border-solid border-(--hl-sm) select-none">
                <Table
                  selectionMode="none"
                  aria-label="Insomnia files"
                  className="w-full table-fixed border-separate border-spacing-0"
                >
                  <TableHeader>
                    <Column
                      isRowHeader
                      className="sticky top-0 z-10 border-b border-(--hl-sm) bg-(--hl-xs) px-2 py-2 text-left text-xs font-semibold backdrop-blur-sm backdrop-filter focus:outline-hidden"
                    >
                      Name
                    </Column>

                    <Column className="sticky top-0 z-10 border-b border-(--hl-sm) bg-(--hl-xs) px-2 py-2 text-left text-xs font-semibold backdrop-blur-sm backdrop-filter focus:outline-hidden">
                      Type
                    </Column>

                    <Column className="sticky top-0 z-10 border-b border-(--hl-sm) bg-(--hl-xs) px-2 py-2 text-left text-xs font-semibold backdrop-blur-sm backdrop-filter focus:outline-hidden">
                      File path
                    </Column>
                  </TableHeader>

                  <TableBody
                    className="divide divide-solid divide-(--hl-sm)"
                    items={insomniaFiles.map(file => ({ id: file.path, ...file }))}
                  >
                    {file => (
                      <Row className="group transition-colors focus-within:bg-(--hl-xxs) focus:outline-hidden">
                        <Cell className="border-b border-solid border-(--hl-sm) text-sm font-medium whitespace-nowrap group-last-of-type:border-none focus:outline-hidden">
                          <div className="flex items-center gap-2 px-2 py-2">
                            <span
                              className={`${scopeToBgColorMap[file.scope]} ${scopeToTextColorMap[file.scope]} flex aspect-square h-6 items-center justify-center rounded-sm`}
                            >
                              <Icon icon={scopeToIconMap[file.scope]} className="w-4" />
                            </span>

                            <span className="truncate">{file.name}</span>

                            {file.path === '.insomnia' && (
                              <span className="flex items-center gap-2 text-(--color-warning)">
                                <Icon icon="triangle-exclamation" />
                              </span>
                            )}
                          </div>
                        </Cell>

                        <Cell className="border-b border-solid border-(--hl-sm) text-sm font-medium whitespace-nowrap group-last-of-type:border-none focus:outline-hidden">
                          <span className="flex items-center gap-1 px-2 text-(--hl)">
                            {scopeToLabelMap[file.scope]}
                          </span>
                        </Cell>

                        <Cell className="border-b border-solid border-(--hl-sm) text-sm font-medium whitespace-nowrap group-last-of-type:border-none focus:outline-hidden">
                          <span className="flex items-center gap-1 text-(--hl) italic">
                            <Icon icon={file.path === '.insomnia' ? 'folder' : 'file'} className="text-(--hl)" />

                            <span className="truncate px-2 text-(--hl)">{file.path}</span>
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
              isDisabled={newProjectFetcher.state !== 'idle' || initCloneGitRepositoryFetcher.state !== 'idle'}
              onPress={() => {
                setActiveView('project');
                setError(null);
              }}
              className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) px-4 py-2 text-sm text-(--color-font) transition-colors hover:bg-(--hl-xs) aria-pressed:bg-(--hl-xs)"
            >
              Back
            </Button>

            {initCloneGitRepositoryFetcher.state !== 'idle' ? (
              <Button
                isDisabled={true}
                type="button"
                className="flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
              >
                Create
              </Button>
            ) : (
              <Button
                isDisabled={newProjectFetcher.state !== 'idle'}
                onPress={onUpsertProject}
                className="flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
              >
                {newProjectFetcher.state !== 'idle' && <Icon icon="spinner" className="animate-spin" />}
                <span>
                  {(() => {
                    if (insomniaFiles) {
                      if (insomniaFiles.length > 0) {
                        if (insomniaFiles.some(file => file.path === '.insomnia')) {
                          return 'Clone and Migrate';
                        } else {
                          return 'Clone Project';
                        }
                      } else {
                        return 'Create Blank Project';
                      }
                    }
                    return 'Create';
                  })()}
                </span>
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
};

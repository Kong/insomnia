import type { StorageRules } from 'insomnia-api';
import type { FC } from 'react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Select,
  SelectValue,
  TextField,
} from 'react-aria-components';
import { useParams } from 'react-router';

import { Banner } from '~/basic-components/banner';
import { Divider } from '~/basic-components/divider';
import { LearnMoreLink } from '~/basic-components/link';
import type { GitCredentials, GitRepository, Project, ProviderEmail } from '~/insomnia-data';
import { models } from '~/insomnia-data';
import { useGitProjectInitCloneActionFetcher } from '~/routes/git.init-clone';
import { useGitProjectRepoFetcher } from '~/routes/git.repo';
import { useGitProviderEmailsLoaderFetcher } from '~/routes/git-provider.emails';
import type { GitProviderOption } from '~/sync/git/providers/types';
import { GitConnectionInfo } from '~/ui/components/git/connection-info';
import { GitOauthAuthBanner } from '~/ui/components/git/git-oauth-auth-banner';
import { GitRepoForm } from '~/ui/components/project/git-repo-form';
import { GitRepoScanResult } from '~/ui/components/project/git-repo-scan-result';
import { ProjectTypeSelect } from '~/ui/components/project/project-type-select';
import { ProjectTypeWarning } from '~/ui/components/project/project-type-warning';
import { useActiveView } from '~/ui/components/project/utils';
import { useIsLightTheme } from '~/ui/hooks/theme';
import { useIsGitSyncEnabled } from '~/ui/hooks/use-organization-features';

import { useProjectUpdateActionFetcher } from '../../../routes/organization.$organizationId.project.$projectId.update';
import { Icon } from '../icon';

const FORMID = 'git-repo-form';
const { isGitCredentialsV2, isOAuthCredential } = models.gitCredentials;

function isSwitchingStorageType(project: Project, storageType: 'local' | 'remote' | 'git') {
  if (storageType === 'git' && !models.project.isGitProject(project)) {
    return true;
  }

  if (storageType === 'local' && (models.project.isRemoteProject(project) || models.project.isGitProject(project))) {
    return true;
  }

  if (storageType === 'remote' && !models.project.isRemoteProject(project)) {
    return true;
  }

  return false;
}

interface Props {
  storageRules: StorageRules;
  project?: Project;
  gitRepository?: GitRepository;
  defaultProjectName?: string;
  onCancel?(): void;
  onSuccessUpdate?(): void;
  credentials: GitCredentials[];
  providers: GitProviderOption[];
}

export const ProjectSettingsForm: FC<Props> = ({
  storageRules,
  project,
  gitRepository,
  defaultProjectName = 'My Project',
  onCancel,
  onSuccessUpdate,
  credentials,
  providers,
}) => {
  const { organizationId } = useParams() as { organizationId: string };

  const isGitSyncEnabled = useIsGitSyncEnabled(organizationId);

  const isLightTheme = useIsLightTheme();

  const [storageType, setStorageType] = useState<'local' | 'remote' | 'git'>(
    models.project.getDefaultProjectStorageType(storageRules, project),
  );

  const { activeView, setActiveView } = useActiveView();

  const showSwitchBanner = useMemo(() => {
    return isSwitchingStorageType(project!, storageType);
  }, [project, storageType]);

  const [error, setError] = useState<string | null>(null);

  const [projectData, setProjectData] = useState<{
    name: string;
    uri?: string;
    ref?: string;
    credentialsId?: string;
    connectRepositoryLater?: boolean;
    selectedAuthorEmail?: string | null;
  }>({
    name: project?.name || defaultProjectName,
    uri: gitRepository?.uri || '',
    credentialsId: gitRepository?.credentialsId ?? undefined,
    connectRepositoryLater: false,
    selectedAuthorEmail: gitRepository?.selectedAuthorEmail ?? null,
  });

  const initCloneGitRepositoryFetcher = useGitProjectInitCloneActionFetcher();
  const gitRepoDataFetcher = useGitProjectRepoFetcher();
  const updateProjectFetcher = useProjectUpdateActionFetcher();

  const insomniaFiles =
    initCloneGitRepositoryFetcher.data && 'files' in initCloneGitRepositoryFetcher.data
      ? initCloneGitRepositoryFetcher.data.files
      : [];

  useEffect(() => {
    if (updateProjectFetcher?.data && updateProjectFetcher?.data?.success && onSuccessUpdate) {
      onSuccessUpdate();
    }
  }, [onSuccessUpdate, updateProjectFetcher.data]);

  useEffect(() => {
    if (updateProjectFetcher.state === 'idle' && updateProjectFetcher.data && updateProjectFetcher.data?.error) {
      setError(updateProjectFetcher.data.error);
    }
  }, [updateProjectFetcher.data, updateProjectFetcher.state]);

  const onUpsertProject = () => {
    if (project) {
      updateProjectFetcher.submit({
        organizationId,
        projectId: project._id,
        projectData: {
          ...projectData,
          storageType,
        },
      });
    }
  };

  const selectedCredential = credentials.find(c => c._id === projectData.credentialsId);
  const selectedProvider = providers.find(p => p.type === selectedCredential?.provider);

  const hideActionButtons = storageType === 'git' && !projectData.connectRepositoryLater && credentials.length === 0;

  const showGitConnectionInfo =
    storageType === 'git' &&
    !isSwitchingStorageType(project!, storageType) &&
    project?.gitRepositoryId !== models.project.EMPTY_GIT_PROJECT_ID &&
    gitRepository?.credentialsId &&
    selectedProvider;

  const showGitRepoForm =
    storageType === 'git' &&
    ((isGitSyncEnabled && isSwitchingStorageType(project!, storageType)) ||
      (!isSwitchingStorageType(project!, storageType) &&
        project?.gitRepositoryId === models.project.EMPTY_GIT_PROJECT_ID));

  const emailsFetcher = useGitProviderEmailsLoaderFetcher();
  const isLoadingEmails = emailsFetcher.state !== 'idle';

  const availableEmails = useMemo(() => {
    const fetchedEmails = emailsFetcher.data?.emails || [];
    if (fetchedEmails.length > 0) {
      return fetchedEmails;
    }
    if (selectedCredential && isGitCredentialsV2(selectedCredential) && isOAuthCredential(selectedCredential)) {
      return selectedCredential.credentials?.emails || [];
    }
    return [];
  }, [selectedCredential, emailsFetcher.data?.emails]);

  const canFetchEmails =
    selectedCredential &&
    isGitCredentialsV2(selectedCredential) &&
    isOAuthCredential(selectedCredential) &&
    selectedProvider?.supportsFetchEmails;

  const showEmailSelector = showGitConnectionInfo && canFetchEmails;
  const [isEmailSelectOpen, setIsEmailSelectOpen] = useState(false);

  useEffect(() => {
    if (canFetchEmails && selectedCredential && emailsFetcher.state === 'idle' && !emailsFetcher.data) {
      emailsFetcher.load({ credentialsId: selectedCredential._id });
    }
  }, [canFetchEmails, selectedCredential, emailsFetcher]);

  // Load git repo metadata (and surface auth errors) for HTTP 4xx fallback when expiresAt is unknown.
  useEffect(() => {
    if (
      showGitConnectionInfo &&
      gitRepository?.uri &&
      gitRepository?._id &&
      project?._id &&
      gitRepoDataFetcher.state === 'idle' &&
      !gitRepoDataFetcher.data
    ) {
      gitRepoDataFetcher.load({ projectId: project._id });
    }
  }, [showGitConnectionInfo, gitRepository?.uri, gitRepository?._id, project?._id, gitRepoDataFetcher]);

  const gitRepoLoadErrors =
    gitRepoDataFetcher.data && 'errors' in gitRepoDataFetcher.data ? gitRepoDataFetcher.data.errors : undefined;

  return (
    <>
      {/* Content */}
      <div className="flex flex-col gap-2 overflow-y-auto">
        {error && (
          <div className="flex items-center gap-2 rounded-xs bg-[rgba(var(--color-danger-rgb),0.5)] px-2 py-1 text-sm text-(--color-font-danger)">
            <Icon icon="triangle-exclamation" />
            <span>{error}</span>
          </div>
        )}

        {/* Important Note: We want to keep the state of the components so we only hide the contents */}
        <div
          className={`flex w-full flex-col justify-start gap-4 pb-2 text-left ${activeView === 'project' ? '' : 'hidden'}`}
        >
          <TextField
            autoFocus
            name="name"
            value={projectData.name}
            onChange={name => setProjectData({ ...projectData, name })}
            className="group relative flex flex-col gap-2 px-0.5"
          >
            <Label className="pt-0 text-sm text-(--color-font)">Project name</Label>
            <Input
              placeholder="My project"
              className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
            />
          </TextField>
          <ProjectTypeSelect
            storageRules={storageRules}
            value={storageType}
            onChange={v => setStorageType(v as 'local' | 'remote' | 'git')}
          />
          <ProjectTypeWarning
            isGitSyncEnabled={isGitSyncEnabled}
            storageType={storageType}
            storageRules={storageRules}
          />

          {showSwitchBanner && storageType === 'remote' && (
            <Banner
              type="info"
              className={`${isLightTheme ? 'bg-[#EEEBFF]' : 'bg-[#292535]'}`}
              title={
                models.project.isGitProject(project!)
                  ? 'Removing Git Sync connection'
                  : 'Converting to Cloud Sync project'
              }
              message={
                models.project.isGitProject(project!)
                  ? 'Changing this project to a Cloud Sync project will remove the connection to your repo. This does not delete the project files on the remote repo.'
                  : 'Anything added in the project will be securely synced to the Insomnia cloud and enables you to collaborate on projects with others. '
              }
              footer={
                <LearnMoreLink
                  href={`https://developer.konghq.com/insomnia/storage/${
                    models.project.isGitProject(project!)
                      ? '#what-happens-if-i-change-a-git-sync-project-into-a-cloud-sync-project'
                      : '#can-i-change-a-local-vault-project-into-a-cloud-sync-project'
                  }`}
                >
                  Learn more about changing project types
                </LearnMoreLink>
              }
            />
          )}
          {showSwitchBanner && storageType === 'local' && (
            <Banner
              type="info"
              className={`${isLightTheme ? 'bg-[#EEEBFF]' : 'bg-[#292535]'}`}
              title={
                models.project.isGitProject(project!)
                  ? 'Removing Git Sync connection'
                  : 'Converting to Local Vault project'
              }
              message={
                models.project.isGitProject(project!)
                  ? 'Changing this project to a Local Vault project will remove the connection to your repo. This does not delete the project files on the remote repo.'
                  : 'Your files will now be stored on your local machine. You will no longer be able to collaborate with others on this project.'
              }
              footer={
                <LearnMoreLink
                  href={`https://developer.konghq.com/insomnia/storage/${
                    models.project.isGitProject(project!)
                      ? '#can-i-change-a-git-sync-project-into-a-local-vault-project'
                      : '#can-i-change-a-cloud-sync-project-into-a-local-vault-project'
                  }`}
                >
                  Learn more about changing project types
                </LearnMoreLink>
              }
            />
          )}

          {showGitConnectionInfo && (
            <>
              <Divider />
              <GitConnectionInfo
                gitRepository={gitRepository}
                providerInfo={selectedProvider}
                authorName={selectedCredential?.author.name || selectedCredential?.author.email}
                projectId={project!._id}
              />
              <GitOauthAuthBanner
                selectedCredential={selectedCredential}
                gitRepository={gitRepository}
                repoLoadErrors={gitRepoLoadErrors}
                provider={selectedProvider}
              />
              {showEmailSelector ? (
                <div className="flex flex-col gap-2">
                  {isLoadingEmails ? (
                    <div className="flex items-center gap-2 text-sm">
                      <Icon icon="spinner" className="animate-spin" />
                      <span>Loading emails...</span>
                    </div>
                  ) : availableEmails.length > 1 ? (
                    <Select
                      onOpenChange={setIsEmailSelectOpen}
                      isOpen={isEmailSelectOpen}
                      aria-label="Author Email"
                      selectedKey={projectData.selectedAuthorEmail || selectedCredential?.author.email}
                      onSelectionChange={email => {
                        setProjectData(prev => ({
                          ...prev,
                          selectedAuthorEmail: email,
                        }));
                      }}
                    >
                      <Label className="mb-2 px-0.5 pt-0 text-sm">Author Email</Label>
                      <Button className="flex w-full flex-1 items-center justify-between gap-2 rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) px-2 py-1 text-(--color-font) ring-1 ring-transparent transition-colors placeholder:italic hover:bg-(--hl-xs) focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden focus:ring-inset aria-pressed:bg-(--hl-sm)">
                        <SelectValue<ProviderEmail> className="flex items-center justify-center gap-2 truncate">
                          {({ selectedItem }) => {
                            if (selectedItem) {
                              return (
                                <Fragment>
                                  <span>{selectedItem.email}</span>
                                  {selectedItem.primary && <span className="text-xs text-(--hl-lg)">(primary)</span>}
                                </Fragment>
                              );
                            }
                            return (
                              projectData.selectedAuthorEmail || selectedCredential?.author.email || 'Select an email'
                            );
                          }}
                        </SelectValue>
                        <Icon icon="caret-down" />
                      </Button>
                      <Popover className="isolate flex w-(--trigger-width) min-w-max flex-col overflow-hidden rounded-md border border-solid border-(--hl-sm) bg-(--color-bg) text-sm shadow-lg select-none">
                        <ListBox
                          items={availableEmails}
                          className="min-w-max overflow-y-auto py-2 focus:outline-hidden"
                        >
                          {item => (
                            <ListBoxItem
                              id={item.email}
                              key={item.email}
                              className="flex h-(--line-height-xs) w-full items-center gap-2 bg-transparent px-(--padding-md) whitespace-nowrap text-(--color-font) transition-colors hover:bg-(--hl-sm) focus:bg-(--hl-xs) focus:outline-hidden disabled:cursor-not-allowed aria-selected:font-bold"
                              aria-label={item.email}
                              textValue={item.email}
                              value={item}
                            >
                              {({ isSelected }) => (
                                <Fragment>
                                  <span>{item.email}</span>
                                  {item.primary && <span className="text-xs text-(--hl-lg)">(primary)</span>}
                                  {isSelected && (
                                    <Icon icon="check" className="justify-self-end text-(--color-success)" />
                                  )}
                                </Fragment>
                              )}
                            </ListBoxItem>
                          )}
                        </ListBox>
                      </Popover>
                    </Select>
                  ) : (
                    <div className="text-[12px]">
                      <div className="flex">
                        <div className="w-[110px] font-semibold">Author Email</div>
                        <div>
                          {projectData.selectedAuthorEmail || selectedCredential?.author.email || 'No email available'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : selectedCredential?.author.email ? (
                <div className="text-[12px]">
                  <div className="flex">
                    <div className="w-[110px] font-semibold">Author Email</div>
                    <div>{selectedCredential?.author.email}</div>
                  </div>
                </div>
              ) : null}
            </>
          )}
          {showGitRepoForm && (
            <GitRepoForm
              projectData={projectData}
              setProjectData={setProjectData}
              initCloneGitRepositoryFetcher={initCloneGitRepositoryFetcher}
              organizationId={organizationId}
              setActiveView={setActiveView}
              credentials={credentials}
              providers={providers}
              formId={FORMID}
            />
          )}
        </div>

        <div className={activeView === 'git-results' ? '' : 'hidden'}>
          <GitRepoScanResult
            initCloneGitRepositoryFetcher={initCloneGitRepositoryFetcher}
            insomniaFiles={insomniaFiles}
            repoURI={projectData.uri}
          />
        </div>
      </div>

      {/* Actions */}

      {activeView === 'project' && !hideActionButtons && (
        <div className="flex w-full items-center justify-end gap-2 px-0.5">
          <div className="flex items-center gap-2">
            {onCancel && (
              <Button
                onPress={onCancel}
                className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) px-4 py-2 text-sm text-(--color-font) transition-colors hover:bg-(--hl-xs) aria-pressed:bg-(--hl-xs)"
              >
                Cancel
              </Button>
            )}
            {storageType === 'git' &&
            !projectData.connectRepositoryLater &&
            (isSwitchingStorageType(project!, storageType) ||
              project?.gitRepositoryId === models.project.EMPTY_GIT_PROJECT_ID ||
              !gitRepository?.credentialsId) ? (
              <Button
                isDisabled={!isGitSyncEnabled && isSwitchingStorageType(project!, storageType)}
                form={FORMID}
                type="submit"
                className="flex h-full w-[14ch] items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
              >
                Scan for files
              </Button>
            ) : (
              <Button
                onPress={onUpsertProject}
                isDisabled={
                  updateProjectFetcher.state !== 'idle' ||
                  (!isSwitchingStorageType(project!, storageType) &&
                    project?.name.trim() === projectData.name.trim() &&
                    (gitRepository?.selectedAuthorEmail ?? null) === (projectData.selectedAuthorEmail ?? null))
                }
                className="flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
              >
                {updateProjectFetcher.state !== 'idle' && <Icon icon="spinner" className="animate-spin" />}
                <span>Update</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {activeView === 'git-results' && (
        <div className="flex items-center justify-end gap-2">
          <Button
            isDisabled={updateProjectFetcher.state !== 'idle' || initCloneGitRepositoryFetcher.state !== 'idle'}
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
              isDisabled={updateProjectFetcher.state !== 'idle'}
              onPress={onUpsertProject}
              className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
            >
              {updateProjectFetcher.state !== 'idle' && <Icon icon="spinner" className="animate-spin" />}
              <span>
                {(() => {
                  if (insomniaFiles) {
                    if (insomniaFiles.length > 0) {
                      if (insomniaFiles.some(file => file.path === '.insomnia')) {
                        return 'Import and Migrate';
                      }
                      return 'Update';
                    }
                    return 'Update';
                  }
                  return 'Update';
                })()}
              </span>
            </Button>
          )}
        </div>
      )}
    </>
  );
};

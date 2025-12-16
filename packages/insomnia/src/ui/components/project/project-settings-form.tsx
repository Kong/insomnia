import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';
import { useParams } from 'react-router';

import { Banner } from '~/basic-components/banner';
import { Divider } from '~/basic-components/divider';
import { LearnMoreLink } from '~/basic-components/link';
import type { StorageRules } from '~/models/organization';
import { useGitProjectInitCloneActionFetcher } from '~/routes/git.init-clone';
import {
  fallbackFeatures,
  useOrganizationPermissionsLoaderFetcher,
} from '~/routes/organization.$organizationId.permissions';
import { GitConnectionInfo } from '~/ui/components/git/connection-info';
import { GitRepoForm } from '~/ui/components/project/git-repo-form';
import { GitRepoScanResult } from '~/ui/components/project/git-repo-scan-result';
import { ProjectTypeSelect } from '~/ui/components/project/project-type-select';
import { ProjectTypeWarning } from '~/ui/components/project/project-type-warning';
import { useActiveView } from '~/ui/components/project/utils';
import { useIsLightTheme } from '~/ui/hooks/theme';
import { useLoaderDeferData } from '~/ui/hooks/use-loader-defer-data';

import type { OauthProviderName } from '../../../models/git-credentials';
import type { GitRepository } from '../../../models/git-repository';
import {
  EMPTY_GIT_PROJECT_ID,
  getDefaultProjectStorageType,
  isGitProject,
  isRemoteProject,
  type Project,
} from '../../../models/project';
import { useProjectUpdateActionFetcher } from '../../../routes/organization.$organizationId.project.$projectId.update';
import { Icon } from '../icon';

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

  const isLightTheme = useIsLightTheme();

  const [storageType, setStorageType] = useState<'local' | 'remote' | 'git'>(
    getDefaultProjectStorageType(storageRules, project),
  );

  const { activeView, setActiveView } = useActiveView();

  const showSwitchBanner = useMemo(() => {
    return isSwitchingStorageType(project!, storageType);
  }, [project, storageType]);

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
              title={isGitProject(project!) ? 'Removing Git Sync connection' : 'Converting to Cloud Sync project'}
              message={
                isGitProject(project!)
                  ? 'Changing this project to a Cloud Sync project will remove the connection to your repo. This does not delete the project files on the remote repo.'
                  : 'Anything added in the project will be securely synced to the Insomnia cloud and enables you to collaborate on projects with others. '
              }
              footer={
                <LearnMoreLink
                  href={`https://developer.konghq.com/insomnia/storage/${
                    isGitProject(project!)
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
              title={isGitProject(project!) ? 'Removing Git Sync connection' : 'Converting to Local Vault project'}
              message={
                isGitProject(project!)
                  ? 'Changing this project to a Local Vault project will remove the connection to your repo. This does not delete the project files on the remote repo.'
                  : 'Your files will now be stored on your local machine. You will no longer be able to collaborate with others on this project.'
              }
              footer={
                <LearnMoreLink
                  href={`https://developer.konghq.com/insomnia/storage/${
                    isGitProject(project!)
                      ? '#can-i-change-a-git-sync-project-into-a-local-vault-project'
                      : '#can-i-change-a-cloud-sync-project-into-a-local-vault-project'
                  }`}
                >
                  Learn more about changing project types
                </LearnMoreLink>
              }
            />
          )}
          {storageType === 'git' &&
            (!isSwitchingStorageType(project!, storageType) && project?.gitRepositoryId !== EMPTY_GIT_PROJECT_ID ? (
              <>
                <Divider />
                <GitConnectionInfo gitRepository={gitRepository} />
              </>
            ) : (
              <GitRepoForm
                projectData={projectData}
                setProjectData={setProjectData}
                initCloneGitRepositoryFetcher={initCloneGitRepositoryFetcher}
                organizationId={organizationId}
                setActiveView={setActiveView}
                selectedTab={selectedTab}
                setTab={setTab}
              />
            ))}
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

      {activeView === 'project' && (
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
            (isSwitchingStorageType(project!, storageType) || project?.gitRepositoryId === EMPTY_GIT_PROJECT_ID) ? (
              <Button
                isDisabled={!isGitSyncEnabled}
                form={selectedTab}
                type="submit"
                className="flex h-full w-[14ch] items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
              >
                Scan for files
              </Button>
            ) : (
              <Button
                onPress={onUpsertProject}
                isDisabled={updateProjectFetcher.state !== 'idle' || updateProjectFetcher.state !== 'idle'}
                className="flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
              >
                {(updateProjectFetcher.state !== 'idle' || updateProjectFetcher.state !== 'idle') && (
                  <Icon icon="spinner" className="animate-spin" />
                )}
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

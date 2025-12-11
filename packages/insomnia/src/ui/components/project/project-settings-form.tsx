import type { FC } from 'react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Cell,
  Column,
  Heading,
  Input,
  Label,
  Row,
  Table,
  TableBody,
  TableHeader,
  TextField,
} from 'react-aria-components';
import { useParams } from 'react-router';

import { Banner } from '~/basic-components/banner';
import { Divider } from '~/basic-components/divider';
import { LearnMoreLink } from '~/basic-components/link';
import { isGitCredentialsOAuth } from '~/models/git-repository';
import type { StorageRules } from '~/models/organization';
import { useGitProjectInitCloneActionFetcher } from '~/routes/git.init-clone';
import {
  fallbackFeatures,
  useOrganizationPermissionsLoaderFetcher,
} from '~/routes/organization.$organizationId.permissions';
import { useProjectNewActionFetcher } from '~/routes/organization.$organizationId.project.new';
import { GitConnectionInfo } from '~/ui/components/git/connection-info';
import { GitRepoForm } from '~/ui/components/project/git-repo-form';
import { ProjectTypeSelect } from '~/ui/components/project/project-type-select';
import { ProjectTypeWarning } from '~/ui/components/project/project-type-warning';
import { useActiveView } from '~/ui/components/project/utils';
import { useIsLightTheme } from '~/ui/hooks/theme';
import { useLoaderDeferData } from '~/ui/hooks/use-loader-defer-data';

import type { OauthProviderName } from '../../../models/git-credentials';
import type { GitRepository } from '../../../models/git-repository';
import { getDefaultProjectStorageType, isGitProject, isRemoteProject, type Project } from '../../../models/project';
import {
  scopeToBgColorMap,
  scopeToIconMap,
  scopeToLabelMap,
  scopeToTextColorMap,
} from '../../../routes/organization.$organizationId.project.$projectId._index';
import { useProjectUpdateActionFetcher } from '../../../routes/organization.$organizationId.project.$projectId.update';
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
  const newProjectFetcher = useProjectNewActionFetcher();

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
    <div className="flex w-full max-w-[600px] flex-col gap-8">
      {error && (
        <div className="flex items-center gap-2 rounded-xs bg-[rgba(var(--color-danger-rgb),0.5)] px-2 py-1 text-sm text-(--color-font-danger)">
          <Icon icon="triangle-exclamation" />
          <span>{error}</span>
        </div>
      )}

      {activeView === 'project' && (
        <>
          <div className="mt-4 flex w-full flex-col justify-start gap-8 text-left">
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
          </div>
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
              footer={<LearnMoreLink href={''}>Learn more about changing project types</LearnMoreLink>}
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
              footer={<LearnMoreLink href={''}>Learn more about changing project types</LearnMoreLink>}
            />
          )}
          {storageType === 'git' && !isSwitchingStorageType(project!, storageType) && (
            <>
              <Divider />
              <GitConnectionInfo gitRepository={gitRepository} />
            </>
          )}
          {storageType === 'git' && isSwitchingStorageType(project!, storageType) && (
            <GitRepoForm
              {...{
                setProjectData,
                projectData,
                initCloneGitRepositoryFetcher,
                organizationId,
                setActiveView,
                selectedTab,
                setTab,
              }}
            />
          )}
          <div className="mt-4 flex w-full items-center justify-end gap-2 px-0.5">
            <div className="flex items-center gap-2">
              {onCancel && (
                <Button
                  onPress={onCancel}
                  className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) px-4 py-2 text-sm text-(--color-font) transition-colors hover:bg-(--hl-xs) aria-pressed:bg-(--hl-xs)"
                >
                  Cancel
                </Button>
              )}
              {storageType === 'git' && isSwitchingStorageType(project!, storageType) && (
                <Button
                  isDisabled={!isGitSyncEnabled}
                  form={selectedTab}
                  type="submit"
                  className="flex h-full w-[14ch] items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
                >
                  Scan for files
                </Button>
              )}
              {storageType === 'git' && !isSwitchingStorageType(project!, storageType) && (
                <Button
                  onPress={onUpsertProject}
                  isDisabled={updateProjectFetcher.state !== 'idle' || newProjectFetcher.state !== 'idle'}
                  className="flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
                >
                  {(updateProjectFetcher.state !== 'idle' || newProjectFetcher.state !== 'idle') && (
                    <Icon icon="spinner" className="animate-spin" />
                  )}
                  <span>Update</span>
                </Button>
              )}
              {storageType !== 'git' && (
                <Button
                  onPress={onUpsertProject}
                  isDisabled={updateProjectFetcher.state !== 'idle' || newProjectFetcher.state !== 'idle'}
                  className="flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
                >
                  {(updateProjectFetcher.state !== 'idle' || newProjectFetcher.state !== 'idle') && (
                    <Icon icon="spinner" className="animate-spin" />
                  )}
                  <span>Update</span>
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
          <div className="flex items-center justify-end gap-2">
            <Button
              isDisabled={updateProjectFetcher.state !== 'idle' || newProjectFetcher.state !== 'idle'}
              onPress={() => {
                setActiveView('project');
                setError(null);
              }}
              className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) px-4 py-2 text-sm text-(--color-font) transition-colors hover:bg-(--hl-xs) aria-pressed:bg-(--hl-xs)"
            >
              Back
            </Button>
            <Button
              isDisabled={updateProjectFetcher.state !== 'idle' || newProjectFetcher.state !== 'idle'}
              onPress={onUpsertProject}
              className="flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
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
    </div>
  );
};

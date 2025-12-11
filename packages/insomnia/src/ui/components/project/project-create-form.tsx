import classNames from 'classnames';
import type { FC } from 'react';
import React, { useEffect, useState } from 'react';
import { Button, Checkbox, Input, Label, TextField } from 'react-aria-components';
import { useParams } from 'react-router';

import { type StorageRules } from '~/models/organization';
import { useGitProjectInitCloneActionFetcher } from '~/routes/git.init-clone';
import {
  fallbackFeatures,
  useOrganizationPermissionsLoaderFetcher,
} from '~/routes/organization.$organizationId.permissions';
import { useProjectNewActionFetcher } from '~/routes/organization.$organizationId.project.new';
import { GitRepoForm } from '~/ui/components/project/git-repo-form';
import { GitRepoScanResult } from '~/ui/components/project/git-repo-scan-result';
import { ProjectTypeSelect } from '~/ui/components/project/project-type-select';
import { ProjectTypeWarning } from '~/ui/components/project/project-type-warning';
import { type ProjectData, type ProjectType, useActiveView } from '~/ui/components/project/utils';
import { useLoaderDeferData } from '~/ui/hooks/use-loader-defer-data';

import type { OauthProviderName } from '../../../models/git-credentials';
import { Icon } from '../icon';

interface Props {
  storageRules: StorageRules;
  isGitSyncEnabled: boolean;
  defaultProjectName?: string;
  onCancel?(): void;
  activeViewObj?: ReturnType<typeof useActiveView>;
}

export const ProjectCreateForm: FC<Props> = ({
  storageRules,
  isGitSyncEnabled,
  defaultProjectName = 'My Project',
  onCancel,
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

  const [storageType, setStorageType] = useState<ProjectType>();

  let { activeView, setActiveView } = useActiveView();
  if (activeViewObj) {
    activeView = activeViewObj.activeView;
    setActiveView = activeViewObj.setActiveView;
  }

  const [selectedTab, setTab] = useState<OauthProviderName>('github');

  const [error, setError] = useState<string | null>(null);

  const [projectData, setProjectData] = useState<ProjectData>({
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

  const insomniaFiles =
    initCloneGitRepositoryFetcher.data && 'files' in initCloneGitRepositoryFetcher.data
      ? initCloneGitRepositoryFetcher.data.files
      : [];

  useEffect(() => {
    if (newProjectFetcher.state === 'idle' && newProjectFetcher.data && newProjectFetcher.data?.error) {
      setError(newProjectFetcher.data.error);
    }
  }, [newProjectFetcher.data, newProjectFetcher.state]);

  const onUpsertProject = () => {
    if (!storageType) {
      return;
    }
    newProjectFetcher.submit({
      organizationId,
      projectData: {
        ...projectData,
        storageType,
      },
    });
  };

  return (
    <div className="flex w-full flex-col gap-4 overflow-y-auto">
      {error && (
        <div className="flex items-center gap-2 rounded-xs bg-[rgba(var(--color-danger-rgb),0.5)] px-2 py-1 text-sm text-(--color-font-danger)">
          <Icon icon="triangle-exclamation" />
          <span>{error}</span>
        </div>
      )}

      <div className={classNames({ hidden: activeView !== 'project' })}>
        <div className="mt-4 flex w-full flex-col justify-start gap-4 pb-2 text-left">
          <TextField
            autoFocus
            name="name"
            value={projectData.name}
            onChange={name => setProjectData({ ...projectData, name })}
            className="group relative flex flex-col gap-2 px-0.5"
          >
            <Label className="pt-0 text-sm text-(--color-font)">Project name</Label>
            <Input
              placeholder={defaultProjectName}
              className="w-full rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) py-1 pr-7 pl-2 text-(--color-font) transition-colors placeholder:italic focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
            />
          </TextField>
          <ProjectTypeSelect
            storageRules={storageRules}
            value={storageType}
            onChange={v => setStorageType(v as ProjectType)}
          />
          <ProjectTypeWarning
            isGitSyncEnabled={isGitSyncEnabled}
            storageType={storageType}
            storageRules={storageRules}
          />
          {storageType === 'git' && (
            <>
              <Checkbox
                slot={null}
                isSelected={projectData.connectRepositoryLater}
                onChange={isSelected => setProjectData(prev => ({ ...prev, connectRepositoryLater: isSelected }))}
                className="group mt-4 flex h-full items-center gap-2 p-0 pl-[1px]"
              >
                <div className="flex h-4 w-4 items-center justify-center rounded-sm ring-1 ring-(--hl-sm) transition-colors group-focus:ring-2 group-data-selected:bg-(--hl-xs)">
                  <Icon
                    icon="check"
                    className="h-3 w-3 opacity-0 group-data-indeterminate:opacity-100 group-data-selected:text-(--color-success) group-data-selected:opacity-100"
                  />
                </div>
                <span className="text-sm text-(--hl)">Connect repository later</span>
              </Checkbox>
              {!projectData.connectRepositoryLater && (
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
            </>
          )}
        </div>
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
            {storageType !== 'git' || projectData.connectRepositoryLater ? (
              <Button
                onPress={onUpsertProject}
                isDisabled={!storageType || newProjectFetcher.state !== 'idle'}
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
      </div>

      <div className={classNames({ hidden: activeView !== 'git-results' })}>
        <GitRepoScanResult
          initCloneGitRepositoryFetcher={initCloneGitRepositoryFetcher}
          insomniaFiles={insomniaFiles}
          repoURI={projectData.uri}
        />
        <div className="mt-8 flex items-center justify-end gap-2">
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
              className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
            >
              {newProjectFetcher.state !== 'idle' && <Icon icon="spinner" className="animate-spin" />}
              <span>
                {(() => {
                  if (insomniaFiles) {
                    if (insomniaFiles.length > 0) {
                      if (insomniaFiles.some(file => file.path === '.insomnia')) {
                        return 'Clone and Migrate';
                      }
                      return 'Clone Project';
                    }
                    return 'Create Blank Project';
                  }
                  return 'Create';
                })()}
              </span>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

import type { StorageRules } from 'insomnia-api';
import type { GitCredentials } from 'insomnia-data';
import type { FC } from 'react';
import React, { useEffect, useState } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';
import { useParams } from 'react-router';

import { useGitProjectInitCloneActionFetcher } from '~/routes/git.init-clone';
import { useProjectNewActionFetcher } from '~/routes/organization.$organizationId.project.new';
import type { GitProviderOption } from '~/sync/git/providers/types';
import { GitRepoForm } from '~/ui/components/project/git-repo-form';
import { GitRepoScanResult } from '~/ui/components/project/git-repo-scan-result';
import { ProjectTypeSelect } from '~/ui/components/project/project-type-select';
import { ProjectTypeWarning } from '~/ui/components/project/project-type-warning';
import { type ProjectData, type ProjectType, useActiveView } from '~/ui/components/project/utils';
import { useIsGitSyncEnabled } from '~/ui/hooks/use-organization-features';

import { Icon } from '../icon';

const FORMID = 'git-repo-form';

interface Props {
  storageRules: StorageRules;
  defaultProjectName?: string;
  onCancel?(): void;
  activeViewObj?: ReturnType<typeof useActiveView>;
  credentials: GitCredentials[];
  providers: GitProviderOption[];
}

export const ProjectCreateForm: FC<Props> = ({
  storageRules,
  defaultProjectName = 'My Project',
  onCancel,
  activeViewObj,
  credentials,
  providers,
}) => {
  const { organizationId } = useParams() as { organizationId: string };

  const isGitSyncEnabled = useIsGitSyncEnabled(organizationId);

  const [storageType, setStorageType] = useState<ProjectType>();

  let { activeView, setActiveView } = useActiveView();
  if (activeViewObj) {
    activeView = activeViewObj.activeView;
    setActiveView = activeViewObj.setActiveView;
  }

  const [error, setError] = useState<string | null>(null);
  const [isGitCredentialInvalid, setIsGitCredentialInvalid] = useState(false);

  const [projectData, setProjectData] = useState<ProjectData>({
    name: defaultProjectName,
    uri: '',
    credentialsId: undefined,
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

  const hideActionButtons = storageType === 'git' && !projectData.connectRepositoryLater && credentials.length === 0;

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
          {storageType === 'git' && isGitSyncEnabled && (
            <GitRepoForm
              formId={FORMID}
              projectData={projectData}
              setProjectData={setProjectData}
              initCloneGitRepositoryFetcher={initCloneGitRepositoryFetcher}
              organizationId={organizationId}
              setActiveView={setActiveView}
              credentials={credentials}
              providers={providers}
              onCredentialValidationChange={setIsGitCredentialInvalid}
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
                form={FORMID}
                isDisabled={!isGitSyncEnabled || isGitCredentialInvalid}
                className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
              >
                Scan for files
              </Button>
            )}
          </div>
        </div>
      )}

      {activeView === 'git-results' && (
        <div className="flex items-center justify-end gap-2">
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
      )}
    </>
  );
};

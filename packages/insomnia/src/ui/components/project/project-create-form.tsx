import type { StorageRules } from 'insomnia-api';
import type { GitCredentials } from 'insomnia-data';
import type { FC } from 'react';
import React, { useEffect, useState } from 'react';
import { Button, Input, Label, TextField } from 'react-aria-components';
import { useParams } from 'react-router';

import { useGitProjectInitCloneActionFetcher } from '~/routes/git.init-clone';
import { useProjectNewActionFetcher } from '~/routes/organization.$organizationId.project.new';
import type { GitProviderOption } from '~/sync/git/providers/types';
import { GitCredentialSelect } from '~/ui/components/git-credentials/git-credential-select';
import { GitRepoForm } from '~/ui/components/project/git-repo-form';
import { GitRepoScanResult } from '~/ui/components/project/git-repo-scan-result';
import { ProjectTypeSelect } from '~/ui/components/project/project-type-select';
import { ProjectTypeWarning } from '~/ui/components/project/project-type-warning';
import { deriveRepoName, type ProjectData, type ProjectType, useActiveView } from '~/ui/components/project/utils';
import { useIsGitSyncEnabled } from '~/ui/hooks/use-organization-features';
import { confirmOpenFolderTrust } from '~/ui/utils/git-folder-trust';
import { selectFileOrFolder } from '~/ui/utils/select-file-or-folder';

import { Icon } from '../icon';

const FORMID = 'git-repo-form';

interface Props {
  storageRules: StorageRules;
  defaultProjectName?: string;
  onCancel?(): void;
  activeViewObj?: ReturnType<typeof useActiveView>;
  credentials: GitCredentials[];
  providers: GitProviderOption[];
  onDirtyChange?: (dirty: boolean) => void;
}

export const ProjectCreateForm: FC<Props> = ({
  storageRules,
  defaultProjectName = 'My Project',
  onCancel,
  activeViewObj,
  credentials,
  providers,
  onDirtyChange,
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
  // Git projects can either clone from a URL or adopt an existing local folder.
  const [gitMode, setGitMode] = useState<'clone' | 'open'>('clone');
  const [openExistingDir, setOpenExistingDir] = useState('');

  // Local repositories default to the native (system git) credentials, which
  // are always present as a seeded singleton and need no remote configuration.
  const nativeCredentialsId = credentials.find(c => c.provider === 'native')?._id;

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

  const changedFieldCount = [
    projectData.name !== defaultProjectName,
    !!storageType,
    projectData.uri && projectData.uri.length > 0,
    !!projectData.credentialsId,
    projectData.connectRepositoryLater !== false,
  ].filter(Boolean).length;

  useEffect(() => {
    if (onDirtyChange) onDirtyChange(changedFieldCount > 1);
  }, [changedFieldCount, onDirtyChange]);

  useEffect(() => {
    if (newProjectFetcher.state === 'idle' && newProjectFetcher.data && newProjectFetcher.data?.error) {
      setError(newProjectFetcher.data.error);
    }
  }, [newProjectFetcher.data, newProjectFetcher.state]);

  const isGitOpen = storageType === 'git' && gitMode === 'open';

  // Preselect native git credentials when adopting a local folder so the user
  // isn't forced to pick before continuing.
  useEffect(() => {
    if (isGitOpen && !projectData.credentialsId && nativeCredentialsId) {
      setProjectData(prev => ({ ...prev, credentialsId: nativeCredentialsId }));
    }
  }, [isGitOpen, projectData.credentialsId, nativeCredentialsId]);

  const onUpsertProject = async () => {
    if (!storageType) {
      return;
    }

    // Opening an arbitrary local folder pulls in whatever it contains, so ask
    // the user to confirm they trust it first.
    if (isGitOpen && openExistingDir && !(await confirmOpenFolderTrust(openExistingDir))) {
      return;
    }

    // For a custom clone location, the picked folder is the parent — clone into
    // `<parent>/<repo-name>`, matching `git clone` behaviour.
    const directory =
      storageType === 'git' && !isGitOpen && !projectData.connectRepositoryLater && projectData.cloneParentDir
        ? window.path.join(projectData.cloneParentDir, deriveRepoName(projectData.uri))
        : undefined;

    newProjectFetcher.submit({
      organizationId,
      projectData: {
        ...projectData,
        storageType,
        directory,
        // Adopting a folder takes its own path — never treat it as connect-later.
        ...(isGitOpen ? { openExistingDirectory: openExistingDir, connectRepositoryLater: false } : {}),
      },
    });
  };

  const onChooseExistingFolder = async () => {
    const { canceled, filePath } = await selectFileOrFolder({
      itemTypes: ['directory'],
      defaultPath: openExistingDir || window.app.getPath('home'),
    });
    if (canceled || !filePath) {
      return;
    }
    setOpenExistingDir(filePath);
  };

  // Credentials are only required for the clone flow; opening a folder needs none.
  const hideActionButtons =
    storageType === 'git' && gitMode === 'clone' && !projectData.connectRepositoryLater && credentials.length === 0;

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
            <>
              <div className="flex w-full gap-2">
                {(['clone', 'open'] as const).map(mode => (
                  <Button
                    key={mode}
                    onPress={() => setGitMode(mode)}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-xs border border-solid px-3 py-1.5 text-sm transition-colors ${
                      gitMode === mode
                        ? 'border-(--color-surprise) bg-(--hl-xs) text-(--color-font)'
                        : 'border-(--hl-md) text-(--color-font) hover:bg-(--hl-xs)'
                    }`}
                  >
                    <Icon icon={mode === 'clone' ? 'cloud-arrow-down' : 'folder-open'} />
                    {mode === 'clone' ? 'Clone from Remote' : 'Open local folder'}
                  </Button>
                ))}
              </div>

              {gitMode === 'clone' ? (
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
              ) : (
                <div className="flex flex-col gap-2 px-0.5">
                  <Label className="text-sm text-(--color-font)">Folder</Label>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 truncate rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) px-2 py-1 text-sm text-(--color-font)">
                      {openExistingDir || 'No folder selected'}
                    </div>
                    <Button
                      onPress={onChooseExistingFolder}
                      className="flex items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-3 py-1 text-sm text-(--color-font) transition-colors hover:bg-(--hl-xs) aria-pressed:bg-(--hl-xs)"
                    >
                      Choose folder…
                    </Button>
                  </div>
                  <p className="text-xs text-(--hl-lg)">
                    Insomnia will open this folder as a Git project. If it isn't a git repository yet, one will be
                    initialized.
                  </p>
                  <GitCredentialSelect
                    credentials={credentials}
                    providers={providers}
                    selectedCredentialsId={projectData.credentialsId ?? nativeCredentialsId}
                    onChange={credentialsId => setProjectData(prev => ({ ...prev, credentialsId }))}
                    label="Git credentials"
                  />
                </div>
              )}
            </>
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
            {storageType !== 'git' || projectData.connectRepositoryLater || isGitOpen ? (
              <Button
                onPress={onUpsertProject}
                isDisabled={!storageType || newProjectFetcher.state !== 'idle' || (isGitOpen && !openExistingDir)}
                className="flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
              >
                {newProjectFetcher.state !== 'idle' && <Icon icon="spinner" className="animate-spin" />}
                <span>{isGitOpen ? 'Open' : 'Create'}</span>
              </Button>
            ) : (
              <Button
                type="submit"
                form={FORMID}
                isDisabled={!isGitSyncEnabled || isGitCredentialInvalid}
                className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
              >
                <span>Scan for files</span>
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

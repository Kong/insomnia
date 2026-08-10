import type { StorageRules } from 'insomnia-api';
import type { GitCredentials } from 'insomnia-data';
import type { FC } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import { Button, Form, Input, Label, TextField } from 'react-aria-components';
import { useNavigate, useParams } from 'react-router';

import { useGitProjectInitCloneActionFetcher } from '~/routes/git.init-clone';
import { useProjectNewActionFetcher } from '~/routes/organization.$organizationId.project.new';
import type { GitProviderOption } from '~/sync/git/providers/types';
import { MiddleTruncate } from '~/ui/components/base/middle-truncate';
import { GitCredentialSelect } from '~/ui/components/git-credentials/git-credential-select';
import { GitRepoForm } from '~/ui/components/project/git-repo-form';
import { GitRepoScanResult } from '~/ui/components/project/git-repo-scan-result';
import { ProjectTypeSelect } from '~/ui/components/project/project-type-select';
import { ProjectTypeWarning } from '~/ui/components/project/project-type-warning';
import { deriveRepoName, getLastCloneParentDir, type ProjectData, type ProjectType, useActiveView } from '~/ui/components/project/utils';
import { useIsGitSyncEnabled } from '~/ui/hooks/use-organization-features';
import { confirmOpenFolderTrust } from '~/ui/utils/git-folder-trust';
import { selectFileOrFolder } from '~/ui/utils/select-file-or-folder';

import { Icon } from '../icon';

const FORMID = 'git-repo-form';
const UPSERT_FORM_ID = 'project-upsert-form';

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
  const navigate = useNavigate();

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
  // Set when the picked folder is already adopted by another project; blocks
  // continuing and offers to open that project instead.
  const [existingFolderProject, setExistingFolderProject] = useState<{
    _id: string;
    name: string;
    organizationId: string;
  } | null>(null);

  // Local repositories default to the native (system git) credentials, which
  // are always present as a seeded singleton and need no remote configuration.
  const nativeCredentialsId = credentials.find(c => c.provider === 'native')?._id;

  const [projectData, setProjectData] = useState<ProjectData>({
    name: defaultProjectName,
    uri: '',
    credentialsId: undefined,
    connectRepositoryLater: false,
    // Default to the folder the user last cloned into so repeated clones land in
    // the same place without re-picking.
    cloneParentDir: getLastCloneParentDir() || undefined,
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

    // Never adopt a folder that's already owned by another project.
    if (isGitOpen && existingFolderProject) {
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
    // Check for an existing project right after picking, so the warning shows
    // before the user tries to open the folder.
    const { project } = await window.main.git.checkGitRepoDirectory({ directory: filePath });
    setExistingFolderProject(project);
  };

  // Credentials are only required for the clone flow; opening a folder needs none.
  const hideActionButtons =
    storageType === 'git' && gitMode === 'clone' && !projectData.connectRepositoryLater && credentials.length === 0;

  // Local/cloud projects (and the git "connect later"/"open folder" variants) create
  // directly; a fresh git clone scans the remote for files first.
  const isUpsertPrimaryAction = storageType !== 'git' || projectData.connectRepositoryLater || isGitOpen;
  const canUpsertProject =
    !!storageType && newProjectFetcher.state === 'idle' && !(isGitOpen && (!openExistingDir || !!existingFolderProject));
  const canScanForFiles = isGitSyncEnabled && !isGitCredentialInvalid;
  const canCloneAfterScan = newProjectFetcher.state === 'idle' && initCloneGitRepositoryFetcher.state === 'idle';

  // React Aria's FocusScope can hand initial focus to the modal header's close
  // button ahead of this field's `autoFocus`; claim it back once mounted.
  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  // Choosing a type collapses the type list, unmounting the focused radio. The
  // child restores focus to its collapsed summary, but Enter there would just
  // reopen the list — put focus back on the name field so Enter runs the CTA.
  // Child effects run before parent effects, so this wins.
  useEffect(() => {
    if (storageType) {
      nameInputRef.current?.focus();
    }
  }, [storageType]);

  // The name field's correct submit-target is dynamic (Create vs. Scan for
  // files), but that's fine inside a real <Form> — onSubmit is just a callback,
  // it can dispatch on current state same as any other handler. This form wraps
  // only the name field + type picker, stopping before the git-clone subtree:
  // GitRepoForm owns its own separate, natively-submitting <Form id={FORMID}>,
  // and nesting two <form> elements is invalid, so they must stay DOM siblings.
  const handleUpsertFormSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (isUpsertPrimaryAction) {
      if (canUpsertProject) {
        onUpsertProject();
      }
      return;
    }
    if (canScanForFiles) {
      (document.getElementById(FORMID) as HTMLFormElement | null)?.requestSubmit();
    }
  };

  // No inputs on this results screen, so there's nothing for native form
  // submission to key off — focus the primary action button once it's ready,
  // same as a native "default button" convention (its own Enter-activation
  // then just works, like any other focused button).
  const cloneButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (activeView === 'git-results' && initCloneGitRepositoryFetcher.state === 'idle') {
      cloneButtonRef.current?.focus();
    }
  }, [activeView, initCloneGitRepositoryFetcher.state]);

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
          <Form id={UPSERT_FORM_ID} className="contents" onSubmit={handleUpsertFormSubmit}>
            <TextField
              autoFocus
              name="name"
              value={projectData.name}
              onChange={name => setProjectData({ ...projectData, name })}
              className="group relative flex flex-col gap-2 px-0.5"
            >
              <Label className="pt-0 text-sm text-(--color-font)">Project name</Label>
              <Input
                ref={nameInputRef}
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
          </Form>
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
                  <p className="text-xs">
                    Insomnia will open this folder as a Git project. If it isn't a git repository yet, one will be
                    initialized.
                  </p>
                  <div className="flex items-center gap-2">
                    {openExistingDir ? (
                      <MiddleTruncate
                        value={openExistingDir}
                        className="h-(--line-height-xs) flex-1 rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) px-2 text-(--color-font)"
                      />
                    ) : (
                      <div className="flex h-(--line-height-xs) flex-1 items-center truncate rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) px-2 text-(--color-font)">
                        No folder selected
                      </div>
                    )}
                    <Button
                      onPress={onChooseExistingFolder}
                      className="flex h-(--line-height-xs) items-center justify-center gap-2 rounded-xs border border-solid border-(--hl-md) px-3 text-sm text-(--color-font) transition-colors hover:bg-(--hl-xs) aria-pressed:bg-(--hl-xs)"
                    >
                      Choose folder…
                    </Button>
                  </div>
                  {existingFolderProject && (
                    <div className="flex flex-col gap-1 text-sm text-(--color-danger)">
                      <span>
                        A project ("{existingFolderProject.name}") is already connected to this folder. Please select
                        another folder, or open the existing project.
                      </span>
                      <Button
                        onPress={() => {
                          navigate(
                            `/organization/${existingFolderProject.organizationId}/project/${existingFolderProject._id}`,
                          );
                          onCancel?.();
                        }}
                        className="self-start underline"
                      >
                        Open project
                      </Button>
                    </div>
                  )}
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
            {isUpsertPrimaryAction ? (
              <Button
                type="submit"
                form={UPSERT_FORM_ID}
                isDisabled={!canUpsertProject}
                className="flex h-full w-[10ch] items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
              >
                {newProjectFetcher.state !== 'idle' && <Icon icon="spinner" className="animate-spin" />}
                <span>{isGitOpen ? 'Open' : 'Create'}</span>
              </Button>
            ) : (
              <Button
                type="submit"
                form={FORMID}
                isDisabled={!canScanForFiles}
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
            isDisabled={!canCloneAfterScan}
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
              ref={cloneButtonRef}
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

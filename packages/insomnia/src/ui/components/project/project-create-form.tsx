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
  Row,
  Table,
  TableBody,
  TableHeader,
  TextField,
} from 'react-aria-components';
import { useParams } from 'react-router';

import { type StorageRules } from '~/models/organization';
import { useGitProjectInitCloneActionFetcher } from '~/routes/git.init-clone';
import {
  fallbackFeatures,
  useOrganizationPermissionsLoaderFetcher,
} from '~/routes/organization.$organizationId.permissions';
import { useProjectNewActionFetcher } from '~/routes/organization.$organizationId.project.new';
import { useActiveView, type ProjectData } from '~/ui/components/project/utils';
import { useLoaderDeferData } from '~/ui/hooks/use-loader-defer-data';
import type { OauthProviderName } from '../../../models/git-credentials';
import { getDefaultProjectStorageType } from '../../../models/project';
import {
  scopeToBgColorMap,
  scopeToIconMap,
  scopeToLabelMap,
  scopeToTextColorMap,
} from '../../../routes/organization.$organizationId.project.$projectId._index';
import { Icon } from '../icon';
import { InsomniaLogo } from '../insomnia-icon';
import { ProjectTypeSelect } from '~/ui/components/project/project-type-select';
import { ProjectTypeWarning } from '~/ui/components/project/project-type-warning';
import { GitRepoForm } from '~/ui/components/project/git-repo-form';

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
    newProjectFetcher.submit({
      organizationId,
      projectData: {
        ...projectData,
        storageType,
      },
    });
  };

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
              <Label className="pt-0 text-sm text-(--color-font)">Project name</Label>
              <Input
                placeholder={defaultProjectName}
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
                className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-sm font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:opacity-80"
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

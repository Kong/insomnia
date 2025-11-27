import classnames from 'classnames';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { type DirectoryDropItem, type FileDropItem, OverlayContainer, useDrop } from 'react-aria';
import { Label, ProgressBar } from 'react-aria-components';
import { useNavigate, useParams, useRevalidator } from 'react-router';
import * as reactUse from 'react-use';

import { database } from '~/common/database';
import type { ScanResult } from '~/common/import';
import { selectFileOrFolder } from '~/common/select-file-or-folder';
import * as models from '~/models';
import type { Project } from '~/models/project';
import { importScannedResources } from '~/routes/import.resources';
import { scanImportResources } from '~/routes/import.scan';
import { useOrganizationLoaderData } from '~/routes/organization';
import { createProject } from '~/routes/organization.$organizationId.project.new';
import { Checkbox } from '~/ui/components/base/checkbox';
import { Modal, type ModalHandle } from '~/ui/components/base/modal';
import { ModalHeader } from '~/ui/components/base/modal-header';
import { Icon } from '~/ui/components/icon';
import { Button } from '~/ui/components/themed-button';

import { showModal } from '..';
import { AlertModal } from '../alert-modal';
import { disclaimer, ScanResultsTable, SupportedFormats, validImportExtensions } from './shared';

interface ProjectFolder {
  name: string;
  getFilePaths: () => Promise<string[]>;
}

interface RootFolder {
  name: string;
  getProjectFolders: () => Promise<ProjectFolder[]>;
}

const selectDir = async () => {
  const { filePath, canceled } = await selectFileOrFolder({
    itemTypes: ['directory'],
  });

  if (canceled) {
    return null;
  }

  if (!filePath) {
    console.error('[Bulk Project Import] No file path in folder selection');
    return null;
  }

  const rootFolder: RootFolder = {
    name: filePath.split('/').pop() || 'Selected Folder',
    getProjectFolders: async () => {
      return window.main.readDir({ path: filePath }).then(files => {
        const projectFolders: ProjectFolder[] = [];

        for (const file of files) {
          if (file.type === 'directory') {
            projectFolders.push({
              name: file.name,
              getFilePaths: async () => {
                const recurse = async (
                  files: {
                    type: 'file' | 'directory';
                    name: string;
                    path: string;
                  }[],
                ) => {
                  const filePaths: string[] = [];
                  for await (const file of files) {
                    if (file.type === 'file') {
                      if (validImportExtensions.some(ext => file.path.endsWith(ext))) {
                        filePaths.push(file.path);
                      }
                    } else if (file.type === 'directory') {
                      const subFilePaths = await recurse(await window.main.readDir({ path: file.path }));
                      filePaths.push(...subFilePaths);
                    }
                  }
                  return filePaths;
                };

                const filePaths = await recurse(await window.main.readDir({ path: file.path }));
                return filePaths;
              },
            });
          }
        }
        return projectFolders;
      });
    },
  };

  return rootFolder;
};

const FileField = ({
  rootFolder,
  onChange,
}: {
  rootFolder: RootFolder | null;
  onChange: (folder: RootFolder) => void;
}) => {
  const dropRef = useRef<HTMLLabelElement>(null);

  const { isDropTarget, dropProps } = useDrop({
    ref: dropRef,
    onDrop: async event => {
      if (event.items.length === 0) {
        return;
      }

      if (event.items.length > 1) {
        console.warn('[Bulk Project Import] Multiple items dropped, only the first folder will be processed');
      }

      const firstDirectory = event.items.find(item => item.kind === 'directory') as DirectoryDropItem | undefined;

      if (!firstDirectory) {
        console.warn('[Bulk Project Import] Could not find a folder in the dropped items');
        return;
      }

      const rootFolder: RootFolder = {
        name: firstDirectory.name,
        getProjectFolders: async () => {
          const entries = firstDirectory.getEntries();
          const projectFolders: ProjectFolder[] = [];

          for await (const entry of entries) {
            if (entry.kind === 'directory') {
              projectFolders.push({
                name: entry.name,
                getFilePaths: async () => {
                  const recurse = async (fileEntries: AsyncIterable<FileDropItem | DirectoryDropItem>) => {
                    const files: string[] = [];
                    for await (const fileEntry of fileEntries) {
                      if (fileEntry.kind === 'file') {
                        const fileObj = await fileEntry.getFile();
                        const filePath = window.webUtils.getPathForFile(fileObj);
                        if (validImportExtensions.some(ext => filePath.endsWith(ext))) {
                          files.push(filePath);
                        }
                      } else if (fileEntry.kind === 'directory') {
                        const subFiles = await recurse(fileEntry.getEntries());
                        files.push(...subFiles);
                      }
                    }
                    return files;
                  };

                  const fileEntries = entry.getEntries();
                  const files = await recurse(fileEntries);

                  return files;
                },
              });
            }
          }
          return projectFolders;
        },
      };

      onChange(rootFolder);
    },
  });

  return (
    <div>
      <label
        {...dropProps}
        onClick={async () => {
          const rootFolder = await selectDir();
          if (!rootFolder) {
            return;
          }
          onChange(rootFolder);
        }}
        className={classnames(
          'flex max-h-[50vh] flex-wrap items-center gap-(--padding-sm) overflow-auto rounded-md border border-solid bg-(--hl-xs) p-(--padding-sm)',
          {
            'border-(--color-surprise)': isDropTarget,
            'border-(--hl-md)': !isDropTarget,
          },
        )}
      >
        {rootFolder ? (
          <div className="flex w-full flex-col items-center justify-start gap-(--padding-sm) rounded-md bg-(--color-bg) p-(--padding-md) text-ellipsis whitespace-nowrap">
            <div>
              <Icon icon="folder" className="mr-1" />
              {rootFolder.name}
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center justify-center gap-(--padding-sm) p-(--padding-md)">
            <div>
              <i className="fa fa-upload fa-xl" />
            </div>
            <div>
              Drag and Drop or <span className="text-(--color-surprise)">Choose Folder</span> to import
            </div>
          </div>
        )}
      </label>
    </div>
  );
};

export const ImportProjectsResourceForm = ({
  onConfirm,
}: {
  onConfirm: (rootFolder: RootFolder, skipExisting: boolean) => void;
}) => {
  const [rootFolder, setRootFolder] = useState<RootFolder | null>(null);
  const [skipExisting, setSkipExisting] = useState<boolean>(false);

  return (
    <>
      <p>
        Please select a folder that contains all the projects that need to be imported. Each project will be named after
        its source file.
      </p>
      <p>{disclaimer}</p>
      <Checkbox
        aria-label={'Skip importing projects that already exist'}
        isSelected={skipExisting}
        onChange={setSkipExisting}
      >
        Skip importing projects that already exist
      </Checkbox>
      <FileField rootFolder={rootFolder} onChange={setRootFolder} />
      <div className="flex items-end justify-between gap-(--padding-sm)">
        <SupportedFormats />
        <Button
          disabled={!rootFolder}
          onClick={() => rootFolder && onConfirm(rootFolder, skipExisting)}
          variant="contained"
          bg="surprise"
          className="gap-(--padding-sm)"
        >
          <i className="fa fa-file-import" />
          Import
        </Button>
      </div>
    </>
  );
};

// Import status for each project
enum ImportStatus {
  PENDING = 'pending',
  CREATING = 'creating',
  IMPORTING = 'importing',
  SKIPPED = 'skipped',
  SUCCESS = 'success',
  FAILED = 'failed',
}

interface ProjectImportItem {
  key: string;
  id?: string;
  name: string;
  status: ImportStatus;
  scanResults: ScanResult[];
  error?: string;
  folder: ProjectFolder;
}

const ProjectImportStatus = ({ status }: { status: ImportStatus }) => {
  const content = useMemo(() => {
    switch (status) {
      case ImportStatus.PENDING: {
        return (
          <>
            <i className="fa fa-hourglass-half mr-2" /> Pending
          </>
        );
      }
      case ImportStatus.CREATING: {
        return (
          <>
            <i className="fa fa-spinner fa-spin mr-2" /> Creating
          </>
        );
      }
      case ImportStatus.IMPORTING: {
        return (
          <>
            <i className="fa fa-spinner fa-spin mr-2" /> Importing
          </>
        );
      }
      case ImportStatus.SKIPPED: {
        return (
          <>
            <i className="fa fa-ban mr-2" /> Skipped
          </>
        );
      }
      case ImportStatus.SUCCESS: {
        return (
          <>
            <i className="fa fa-check mr-2" /> Success
          </>
        );
      }
      case ImportStatus.FAILED: {
        return (
          <>
            <i className="fa fa-exclamation-triangle mr-2" /> Failed
          </>
        );
      }
      default: {
        return null;
      }
    }
  }, [status]);

  return (
    <div
      className={classnames('flex items-center', {
        'text-success': status === ImportStatus.SUCCESS,
        'text-danger': status === ImportStatus.FAILED,
      })}
    >
      {content}
    </div>
  );
};

const ProjectItem = ({ project }: { project: ProjectImportItem }) => {
  const [expanded, setExpanded] = useState(false);
  const expendable = useMemo(
    () => [ImportStatus.IMPORTING, ImportStatus.SUCCESS, ImportStatus.FAILED].includes(project.status),
    [project.status],
  );

  return (
    <div className="rounded-md border border-solid border-(--hl-md)">
      <div
        data-expandable={expendable}
        className="flex items-center justify-between p-3 data-[expandable=true]:cursor-pointer"
        onClick={() => expendable && setExpanded(!expanded)}
      >
        <div className="font-medium">{project.name}</div>
        <div className="align-center flex items-center gap-2">
          <ProjectImportStatus status={project.status} />
          <Icon
            icon="chevron-down"
            className={classnames('ml-2 transition-transform duration-200', {
              'rotate-180': expanded,
              'rotate-0': !expanded,
              'text-(--hl-xs)': !expendable,
            })}
          />
        </div>
      </div>

      {expanded && project.status === ImportStatus.FAILED && (
        <div className="text-danger border-t border-solid border-(--hl-md) bg-(--hl-xs) p-3">
          <div className="flex items-center gap-2">
            <i className="fa fa-exclamation-circle" />
            Import failed: {project.error || 'Unknown error'}
          </div>
        </div>
      )}
      {expanded && [ImportStatus.IMPORTING, ImportStatus.SUCCESS].includes(project.status) && (
        <ScanResultsTable scanResults={project.scanResults} />
      )}
    </div>
  );
};

const ImportProjectsList = ({
  rootFolder,
  projectItems,
  uiStatus,
  error,
  onComplete,
  cancelled,
  onCancel,
}: {
  rootFolder: RootFolder;
  projectItems: ProjectImportItem[];
  uiStatus: 'loading' | 'importing' | 'error' | 'complete';
  error: string | null;
  onComplete: (projectItems: ProjectImportItem[]) => void;
  cancelled: boolean;
  onCancel: () => void;
}) => {
  const { total, completed, progress } = useMemo(() => {
    const total = projectItems.length;
    const completed = projectItems.filter(item =>
      [ImportStatus.SUCCESS, ImportStatus.FAILED, ImportStatus.SKIPPED].includes(item.status),
    ).length;

    return {
      total,
      completed,
      progress: total > 0 ? Math.trunc((completed / total) * 100) : 0,
    };
  }, [projectItems]);

  if (uiStatus === 'loading') {
    return (
      <div className="flex items-center justify-center p-4">
        <i className="fa fa-spinner fa-spin fa-2x" />
        <span className="ml-2">Loading projects...</span>
      </div>
    );
  }

  if (uiStatus === 'error') {
    return (
      <>
        <div className="text-danger py-4">
          <i className="fa fa-exclamation-triangle mr-2" />
          <span>Error: {error || 'An unknown error occurred'}</span>
        </div>

        <div className="mt-4 flex justify-end">
          <Button variant="contained" bg="surprise" onClick={() => onComplete([])} className="h-10 gap-(--padding-sm)">
            Confirm
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="text-lg font-bold">Import projects from: {rootFolder.name}</p>

      <ProgressBar value={progress}>
        {({ percentage, valueText }) => (
          <>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-sm font-medium">
                {completed < total ? `Processing folder #${completed + 1} of ${total}` : `Completed`}
              </Label>
              <span className="text-sm font-medium text-(--color-surprise)">{valueText}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-(--hl-xs)">
              <div
                className="fill h-full rounded-full bg-(--color-surprise) transition-all duration-300 ease-in-out"
                style={{ width: percentage + '%' }}
              />
            </div>
          </>
        )}
      </ProgressBar>

      <div className="mb-4 flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
        {projectItems.map(project => (
          <ProjectItem key={project.key} project={project} />
        ))}
      </div>

      <div className="mt-4 flex justify-end gap-(--padding-md)">
        {uiStatus === 'importing' && !cancelled && (
          <Button
            variant="contained"
            bg="danger"
            onClick={() => {
              showModal(AlertModal, {
                title: 'Cancel Import?',
                message:
                  'If you cancel now, Insomnia will finish importing the current folder then stop. You’ll be able to use projects that have already been imported. Do you wish to cancel?',
                addCancel: true,
                onConfirm: onCancel,
              });
            }}
            className="h-10 gap-(--padding-sm)"
          >
            Cancel
          </Button>
        )}
        <Button
          variant="contained"
          bg="surprise"
          disabled={uiStatus === 'importing'}
          onClick={() => onComplete(projectItems)}
          className="h-10 gap-(--padding-sm)"
        >
          Confirm
        </Button>
      </div>
    </>
  );
};

/**
 * Component for importing projects into an organization.
 */
export const ImportProjectsModal = ({ organizationId, onHide }: { organizationId: string; onHide: () => void }) => {
  const [rootFolder, setRootFolder] = useState<RootFolder | null>(null);
  const modalRef = useRef<ModalHandle>(null);
  const params = useParams();
  const navigate = useNavigate();
  const { revalidate } = useRevalidator();

  useEffect(() => {
    // Hmm, the modal doesn't support to drive by state, so we need to show it manually.
    modalRef.current?.show();
  }, []);

  const organizationData = useOrganizationLoaderData();
  const organizationName =
    organizationData?.organizations.find(org => org.id === organizationId)?.display_name || 'Organization';

  const [projectItems, setProjectItems] = useState<ProjectImportItem[]>([]);
  const [processingUIStatus, setProcessingUiStatus] = useState<'loading' | 'importing' | 'error' | 'complete'>(
    'loading',
  );
  const [processingCancelled, setProcessingCancelled] = useState(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const latestProcessingCancelled = reactUse.useLatest(processingCancelled);

  // We should use an abort controller to cancel the import process, but currently the import process is not immediate cancelable, so fall back to a flag.
  const unmountRef = useRef(false);
  useEffect(() => {
    unmountRef.current = false;
    return () => {
      unmountRef.current = true;
    };
  }, []);

  // Due to this issue: https://github.com/remix-run/react-router/issues/13712, currently use functions to handle the import process.
  // After the issue is resolved, we can use fetcher to handle the import process.
  const processBulkProjectImport = async (rootFolder: RootFolder, organizationId: string, skipExisting?: boolean) => {
    try {
      if (!rootFolder) {
        // Should never happen, but just in case
        throw new Error('Root folder is not set');
      }

      // Only necessary if skipExisting is true
      const existingProjects = skipExisting
        ? await database.find<Project>(models.project.type, {
            parentId: organizationId,
          })
        : [];

      // Load projects from the root folder
      const projectItems: ProjectImportItem[] = (await rootFolder.getProjectFolders()).map((projectFolder, i) => ({
        key: `${organizationId}-${i}-${projectFolder.name}`,
        name: projectFolder.name,
        status:
          skipExisting && existingProjects.find(p => p.name === projectFolder.name)
            ? ImportStatus.SKIPPED
            : ImportStatus.PENDING,
        scanResults: [],
        folder: projectFolder,
      }));

      if (projectItems.length === 0) {
        throw new Error('No projects found in the selected directory');
      }

      // Sort project items by name
      projectItems.sort((a, b) => a.name.localeCompare(b.name));
      setProjectItems(projectItems);

      // Start import process for the projects
      setProcessingUiStatus('importing');

      const startImportForProject = async (project: ProjectImportItem) => {
        const projectIndex = projectItems.indexOf(project);

        const updateProjectItem = (updates: Partial<ProjectImportItem>) => {
          setProjectItems(prevItems => {
            const newItems = [...prevItems];
            newItems[projectIndex] = { ...newItems[projectIndex], ...updates };
            return newItems;
          });
        };

        // Only skip the project when it's not in pending status, otherwise we need to add a new status or more to tell the user that the project is created but not imported or xxx.
        if (latestProcessingCancelled.current || unmountRef.current) {
          updateProjectItem({ status: ImportStatus.SKIPPED });
          return;
        }

        try {
          updateProjectItem({ status: ImportStatus.CREATING });

          const createdProjectId = await createProject(organizationId, {
            storageType: 'remote',
            name: project.name,
          });

          if (!createdProjectId) {
            throw new Error('Project creation failed');
          }
          console.debug('[Bulk Project Import] Created project ID:', createdProjectId);

          updateProjectItem({ status: ImportStatus.IMPORTING, id: createdProjectId });

          const filePaths = await project.folder.getFilePaths();
          // Use archive.json to identify Postman environment files, only consider the first one currently.
          const archiveFileIndex = filePaths.findIndex(
            filePath => filePath.endsWith('/archive.json') || filePath.endsWith('\\archive.json'),
          );

          let postmanArchiveFile: string | null = null;
          if (archiveFileIndex >= 0) {
            postmanArchiveFile = filePaths[archiveFileIndex];
            filePaths.splice(archiveFileIndex, 1);
          }

          if (!filePaths.length) {
            updateProjectItem({
              status: ImportStatus.SUCCESS,
              scanResults: [],
            });
            return;
          }

          const scanResults = await scanImportResources({
            source: 'file',
            filePaths,
            postmanArchiveFile,
          });

          if (!scanResults?.length) {
            console.warn('[Bulk Project Import] No scan results found, skipping import for this project');
            updateProjectItem({
              status: ImportStatus.SUCCESS,
              scanResults: [],
            });
            return;
          }

          updateProjectItem({
            scanResults,
          });

          if (!scanResults.some(({ errors }) => errors.length === 0)) {
            console.warn('[Bulk Project Import] No valid scan results found, skipping import for this project');
            updateProjectItem({
              status: ImportStatus.SUCCESS,
            });
            return;
          }

          await importScannedResources({
            organizationId,
            projectId: createdProjectId,
          });

          console.debug('[Bulk Project Import] Import completed successfully for project:', project.name);
          updateProjectItem({
            status: ImportStatus.SUCCESS,
          });
        } catch (error) {
          console.error('[Bulk Project Import] Import error:', project.name, error);
          updateProjectItem({
            status: ImportStatus.FAILED,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      };

      // Start the import process for each project
      for await (const project of projectItems) {
        if (project.status === ImportStatus.PENDING) {
          await startImportForProject(project);
        }
      }

      setProcessingUiStatus('complete');
    } catch (error) {
      console.error('[Bulk Project Import] Import error:', error);
      setProcessingError(error instanceof Error ? error.message : String(error));
      setProcessingUiStatus('error');
    }
  };

  const handleConfirm = async (rootFolder: RootFolder, skipExisting: boolean) => {
    setRootFolder(rootFolder);
    processBulkProjectImport(rootFolder, organizationId, skipExisting);
  };

  // Handler for completing the import process
  const handleComplete = (projectItems: ProjectImportItem[]) => {
    onHide();
    // If there's no projectId in the URL params, that means the current url is `organization/:organizationId/project`, the loader will always return a empty project list.
    // So we need to navigate to the first project in the imported list.
    if (params.organizationId && !params.projectId && projectItems?.[0]?.id) {
      navigate(`/organization/${params.organizationId}/project/${projectItems[0].id}`);
    } else {
      revalidate();
    }
  };

  const handleCancel = () => {
    setProcessingCancelled(true);
    console.warn('[Bulk Project Import] Import process cancelled by user');
  };

  return (
    <OverlayContainer onClick={e => e.stopPropagation()}>
      <Modal
        ref={modalRef}
        onHide={onHide}
        maskClosable={rootFolder ? false : true}
        keyboardClosable={rootFolder ? false : true}
      >
        <ModalHeader hideCloseButton={!!rootFolder}>Import projects to "{organizationName}" Organization</ModalHeader>

        {!rootFolder ? (
          <ImportProjectsResourceForm onConfirm={handleConfirm} />
        ) : (
          <ImportProjectsList
            rootFolder={rootFolder}
            projectItems={projectItems}
            uiStatus={processingUIStatus}
            error={processingError}
            onComplete={handleComplete}
            cancelled={processingCancelled}
            onCancel={handleCancel}
          />
        )}
      </Modal>
    </OverlayContainer>
  );
};

import classnames from 'classnames';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type DirectoryDropItem, OverlayContainer, useDrop } from 'react-aria';
import { useFetcher, useNavigate, useParams } from 'react-router';

import { database } from '../../../../common/database';
import type { ScanResult } from '../../../../common/import';
import { selectFileOrFolder } from '../../../../common/select-file-or-folder';
import * as models from '../../../../models';
import type { Project } from '../../../../models/project';
import type { CreateProjectActionResult } from '../../../routes/$organizationId.project.new';
import type { ImportResourcesActionResult } from '../../../routes/import.resources';
import { useOrganizationLoaderData } from '../../../routes/organization';
import { Checkbox } from '../../base/checkbox';
import { Modal, type ModalHandle } from '../../base/modal';
import { ModalHeader } from '../../base/modal-header';
import { Icon } from '../../icon';
import { Button } from '../../themed-button';
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
    console.error('[Bulk Project Import] No file path in directory selection');
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
                return await window.main.readDir({ path: file.path }).then(files => {
                  return files
                    .filter(file => file.type === 'file')
                    .map(file => file.path)
                    .filter(filePath => validImportExtensions.some(ext => filePath.endsWith(ext)));
                });
              },
            });
          }
        }
        return projectFolders;
      });
    },
  };

  // Create a DirectoryDropItem from the selected folder
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
        console.warn('[Bulk Project Import] Could not find a directory in the dropped items');
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
                  const files: string[] = [];
                  const fileEntries = entry.getEntries();
                  for await (const fileEntry of fileEntries) {
                    if (fileEntry.kind === 'file') {
                      const fileObj = await fileEntry.getFile();
                      const filePath = window.webUtils.getPathForFile(fileObj);
                      if (validImportExtensions.some(ext => filePath.endsWith(ext))) {
                        files.push(filePath);
                      }
                    }
                  }
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
          'flex max-h-[50vh] flex-wrap items-center gap-[var(--padding-sm)] overflow-auto rounded-[var(--radius-md)] border border-solid bg-[color:var(--hl-xs)] p-[var(--padding-sm)]',
          {
            'border-[color:var(--color-surprise)]': isDropTarget,
            'border-[color:var(--hl-md)]': !isDropTarget,
          },
        )}
      >
        {rootFolder ? (
          <div className="flex w-full flex-col items-center justify-start gap-[var(--padding-sm)] text-ellipsis whitespace-nowrap rounded-[var(--radius-md)] bg-[color:var(--color-bg)] p-[var(--padding-md)]">
            <div>
              <Icon icon="folder" className="mr-1" />
              {rootFolder.name}
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col items-center justify-center gap-[var(--padding-sm)] p-[var(--padding-md)]">
            <div>
              <i className="fa fa-upload fa-xl" />
            </div>
            <div>
              Drag and Drop or <span className="text-[color:var(--color-surprise)]">Choose Folder</span> to import
            </div>
          </div>
        )}
      </label>
    </div>
  );
};

export const OrgImportResourceForm = ({
  onConfirm,
}: {
  onConfirm: (importForm: { rootFolder: RootFolder; skipExisting: boolean }) => void;
}) => {
  const [rootFolder, setRootFolder] = useState<RootFolder | null>(null);
  const [skipExisting, setSkipExisting] = useState<boolean>(false);

  return (
    <>
      <p>
        Please select a folder that contains all the projects that need to be imported. Each project will be named after
        its source file.
      </p>
      <FileField rootFolder={rootFolder} onChange={setRootFolder} />
      <SupportedFormats />
      <p>{disclaimer}</p>
      <div className="flex items-center justify-between gap-[var(--padding-sm)]">
        <Checkbox
          aria-label={'Skip importing projects that already exist'}
          className="group flex h-full items-center p-0"
          isSelected={skipExisting}
          onChange={setSkipExisting}
        >
          Skip importing projects that already exist
        </Checkbox>
        <Button
          disabled={!rootFolder}
          onClick={() =>
            rootFolder &&
            onConfirm({
              rootFolder,
              skipExisting,
            })
          }
          variant="contained"
          bg="surprise"
          className="gap-[var(--padding-sm)]"
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
  FAIL = 'fail',
}

// Project import item
interface ProjectImportItem {
  id?: string;
  name: string;
  status: ImportStatus;
  scanResults: ScanResult[];
  error?: string;
  folder: ProjectFolder; // Optional, used for the folder structure
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
      case ImportStatus.FAIL: {
        return (
          <>
            <i className="fa fa-exclamation-triangle mr-2" /> Fail
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
        'text-danger': status === ImportStatus.FAIL,
      })}
    >
      {content}
    </div>
  );
};

const ProjectItem = ({ project }: { project: ProjectImportItem }) => {
  const [expanded, setExpanded] = useState(false);
  const extendable = useMemo(
    () => [ImportStatus.IMPORTING, ImportStatus.SUCCESS, ImportStatus.FAIL].includes(project.status),
    [project.status],
  );

  return (
    <div key={project.id} className="rounded-[var(--radius-md)] border border-solid border-[color:var(--hl-md)]">
      <div
        className="flex cursor-pointer items-center justify-between p-3"
        onClick={() => extendable && setExpanded(!expanded)}
      >
        <div className="font-medium">{project.name}</div>
        <div className="align-center flex items-center gap-2">
          <ProjectImportStatus status={project.status} />
          <Icon
            icon="chevron-down"
            className={classnames('ml-2 transition-transform duration-200', {
              'rotate-180': expanded,
              'rotate-0': !expanded,
              'text-[color:var(--hl-xs)]': !extendable,
              'cursor-pointer': extendable,
              'cursor-not-allowed': !extendable,
            })}
          />
        </div>
      </div>

      {/* Project details when expanded */}
      {expanded && project.status === ImportStatus.FAIL && (
        <div className="text-danger border-t border-solid border-[color:var(--hl-md)] bg-[color:var(--hl-xs)] p-3">
          <div className="flex items-center gap-2">
            <i className="fa fa-exclamation-circle" />
            Failed to import: {project.error || 'Unknown error'}
          </div>
        </div>
      )}
      {expanded && [ImportStatus.IMPORTING, ImportStatus.SUCCESS].includes(project.status) && (
        <ScanResultsTable scanResults={project.scanResults} />
      )}
    </div>
  );
};

const OrgImportList = ({
  organizationId,
  rootFolder,
  skipExisting,
  onComplete,
}: {
  organizationId: string;
  rootFolder: RootFolder;
  skipExisting?: boolean;
  onComplete: (projectItems: ProjectImportItem[]) => void;
}) => {
  const [projectItems, setProjectItems] = useState<ProjectImportItem[]>([]);
  const [uiStatus, setUiStatus] = useState<'loading' | 'importing' | 'error' | 'complete'>('loading');
  const [error, setError] = useState<string | null>(null);

  // https://deepwiki.com/search/did-not-find-corresponding-fet_7e78751d-6bce-4a34-8d9d-34f44471b8b7
  const createProjectFetcher = useFetcher<CreateProjectActionResult>({
    // key: 'createProject',
  });
  const createProjectFetcherRef = useRef(createProjectFetcher);
  createProjectFetcherRef.current = createProjectFetcher;
  const scanResourcesFetcher = useFetcher<ScanResult[]>({
    // key: 'scanResources',
  });
  const scanResourcesFetcherRef = useRef(scanResourcesFetcher);
  scanResourcesFetcherRef.current = scanResourcesFetcher;
  const importFetcher = useFetcher<ImportResourcesActionResult>({
    // key: 'importResources',
  });
  const importFetcherRef = useRef(importFetcher);
  importFetcherRef.current = importFetcher;

  const handleImport = useCallback(
    async (rootFolder: RootFolder, organizationId: string, skipExisting?: boolean) => {
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
        const projectItems: ProjectImportItem[] = (await rootFolder.getProjectFolders()).map(projectFolder => ({
          name: projectFolder.name,
          status:
            skipExisting && existingProjects.find(p => p.name === projectFolder.name)
              ? ImportStatus.SKIPPED
              : ImportStatus.PENDING,
          scanResults: [],
          expanded: false,
          folder: projectFolder,
        }));

        // Sort project items by name
        projectItems.sort((a, b) => a.name.localeCompare(b.name));
        setProjectItems(projectItems);

        if (projectItems.length === 0) {
          throw new Error('No projects found in the selected directory');
        }

        // Start import process for the projects
        setUiStatus('importing');

        const startImportForProject = async (project: ProjectImportItem) => {
          const projectIndex = projectItems.indexOf(project);

          const updateProjectItem = (updates: Partial<ProjectImportItem>) => {
            setProjectItems(prevItems => {
              const newItems = [...prevItems];
              newItems[projectIndex] = { ...newItems[projectIndex], ...updates };
              return newItems;
            });
          };

          try {
            // Update status to CREATING
            updateProjectItem({ status: ImportStatus.CREATING });

            await createProjectFetcher.submit(
              {
                storageType: 'remote',
                name: project.name,
                withRedirect: false,
              },
              {
                action: `/organization/${organizationId}/project/new`,
                method: 'POST',
                encType: 'application/json',
              },
            );

            // Could only get the created project ID from the fetcher ref currently, could be improved after react-router solves
            // See https://github.com/orgs/remix-run/projects/5?pane=issue&itemId=62177552
            const createdProjectId = createProjectFetcherRef.current.data?.id;

            if (!createdProjectId) {
              throw new Error(createProjectFetcherRef.current.data?.error || 'Project creation failed');
            }

            console.debug('[Bulk Project Import] Created project ID:', createdProjectId);
            updateProjectItem({ status: ImportStatus.IMPORTING, id: createdProjectId });

            // Scan resources for the project files
            const scanFormData = new FormData();
            scanFormData.append('importFrom', 'file');

            // For each directory, collect the files inside
            const filePaths = await project.folder.getFilePaths();
            scanFormData.append('filePaths', JSON.stringify(filePaths));

            // await sleep(1);

            // Scan resources, it's stored in the memory for the next step
            await scanResourcesFetcher.submit(scanFormData, {
              method: 'post',
              action: '/import/scan',
              encType: 'multipart/form-data',
            });

            // This is for displaying the scan results in the UI
            const scanResults = scanResourcesFetcherRef.current.data;

            if (!scanResults?.length) {
              console.warn('[Bulk Project Import] No scan results found, skipping import for this project');
              updateProjectItem({
                status: ImportStatus.SUCCESS,
                scanResults: [],
              });
              return;
            }

            console.log(scanResults);

            updateProjectItem({
              scanResults,
            });

            const importFormData = new FormData();
            importFormData.append('organizationId', organizationId);
            importFormData.append('projectId', createdProjectId);

            // Submit import request
            await importFetcher.submit(importFormData, {
              method: 'post',
              action: '/import/resources',
              encType: 'multipart/form-data',
            });

            // Wait for import to complete
            if (importFetcher.data?.errors?.length) {
              throw new Error('Import failed', { cause: importFetcher.data.errors });
            }

            console.debug('[Bulk Project Import] Import completed successfully for project:', project.name);
            updateProjectItem({
              status: ImportStatus.SUCCESS,
            });
          } catch (error) {
            console.error('[Bulk Project Import] Import error:', project.name, error);
            updateProjectItem({
              status: ImportStatus.FAIL,
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

        setUiStatus('complete');
      } catch (error) {
        console.error('[Bulk Project Import] Import error:', error);
        setError(error instanceof Error ? error.message : String(error));
        setUiStatus('error');
      }
    },
    [createProjectFetcher, importFetcher, scanResourcesFetcher],
  );

  const firstRef = useRef(true);
  // Load projects from the root folder
  useEffect(() => {
    // Only run this effect once
    if (!firstRef.current) {
      return;
    }
    firstRef.current = false;

    (async () => {
      await handleImport(rootFolder, organizationId, skipExisting);
    })();

    // TODO: Interrupt the import process when unmounted, but it shouldn't happen.
    return () => {};
  }, [handleImport, organizationId, rootFolder, skipExisting]);

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
          <Button
            variant="contained"
            bg="surprise"
            onClick={() => onComplete([])}
            className="h-10 gap-[var(--padding-sm)]"
          >
            Confirm
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <p className="text-lg font-bold">Import projects from: {rootFolder.name}</p>

      <div className="mb-4 flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
        {projectItems.map(project => (
          <ProjectItem key={project.id} project={project} />
        ))}
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          variant="contained"
          bg="surprise"
          disabled={uiStatus === 'importing'}
          onClick={() => onComplete(projectItems)}
          className="h-10 gap-[var(--padding-sm)]"
        >
          Confirm
        </Button>
      </div>
    </>
  );
};

/**
 * OrgImportModal component for importing projects into an organization.
 */
export const OrgImportModal = ({ organizationId, onHide }: { organizationId: string; onHide: () => void }) => {
  const [rootFolder, setRootFolder] = useState<RootFolder | null>(null);
  const [skipExisting, setSkipExisting] = useState<boolean>(false);
  const modalRef = useRef<ModalHandle>(null);
  const params = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    // Hmm, the modal doesn't support to drive by state, so we need to show it manually.
    modalRef.current?.show();
  }, []);

  const organizationData = useOrganizationLoaderData();
  const organizationName =
    organizationData?.organizations.find(org => org.id === organizationId)?.display_name || 'Organization';

  // Handler for completing the import process
  const handleComplete = (projectItems: ProjectImportItem[]) => {
    onHide();
    // If there's no projectId in the URL params, that means the current url is `organization/:organizationId/project`, the loader will always return a empty project list.
    // So we need to navigate to the first project in the imported list.
    if (params.organizationId && !params.projectId && projectItems.length > 0) {
      navigate(`/organization/${params.organizationId}/project/${projectItems[0].id}`);
    }
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
          <OrgImportResourceForm
            onConfirm={({ rootFolder, skipExisting }) => {
              setRootFolder(rootFolder);
              setSkipExisting(skipExisting);
            }}
          />
        ) : (
          <OrgImportList
            organizationId={organizationId}
            rootFolder={rootFolder}
            skipExisting={skipExisting}
            onComplete={handleComplete}
          />
        )}
      </Modal>
    </OverlayContainer>
  );
};

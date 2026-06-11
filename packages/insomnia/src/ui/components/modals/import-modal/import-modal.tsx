import classNames from 'classnames';
import { formatDistanceToNowStrict } from 'date-fns';
import { models } from 'insomnia-data';
import React, { type FC, Fragment, type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { type DirectoryDropItem, type FileDropItem, OverlayContainer, useDrop } from 'react-aria';
import { Heading, Link } from 'react-aria-components';
import { useNavigate, useParams } from 'react-router';

import { isNotNullOrUndefined } from '~/common/misc';
import { useImportResourcesFetcher } from '~/routes/import.resources';
import { useScanResourcesFetcher } from '~/routes/import.scan';
import { useProjectListWorkspacesLoaderFetcher } from '~/routes/organization.$organizationId.project.$projectId.list-workspaces';
import { createProject } from '~/routes/organization.$organizationId.project.new';
import { Checkbox } from '~/ui/components/base/checkbox';

import {
  clearResourceCache,
  findExistingImportedSpec,
  findRequestInExistingWorkspace,
  type ImportSourceType,
  type ScanResult,
} from '../../../../common/import';
import { invariant } from '../../../../utils/invariant';
import {
  AnalyticsEvent,
  importAttributionKey,
  PENDING_IMPORT_ATTRIBUTION_KEY,
  readPendingImportAttribution,
  trackImportEvent,
} from '../../../analytics';
import { Modal, type ModalHandle, type ModalProps } from '../../base/modal';
import { ModalHeader } from '../../base/modal-header';
import { HelpTooltip } from '../../help-tooltip';
import { Icon } from '../../icon';
import { Button } from '../../themed-button';
import { CurlIcon, isApiSpecScanResult, ScanResultsTable, SupportedFormats, validImportExtensions } from './shared';

export const Radio: FC<{
  name: string;
  value: string;
  children: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}> = ({ name, value, onChange, children, checked, defaultChecked }) => {
  const id = useId();
  return (
    <div className="has-checked:bg-(--color-bg)">
      <input
        id={id}
        type="radio"
        name={name}
        checked={checked}
        value={value}
        defaultChecked={defaultChecked}
        onChange={onChange}
        style={{
          clip: 'rect(0,0,0,0)',
        }}
        className="absolute -m-px h-px w-px overflow-hidden border-0 p-0 whitespace-nowrap"
      />
      <label
        className="flex items-center gap-(--padding-sm) rounded-md p-(--padding-sm)"
        data-test-id={`import-from-${value}`}
        htmlFor={id}
      >
        {children}
      </label>
    </div>
  );
};

enum ENTRY_TYPE {
  FILE,
  DIR,
}

interface Entry {
  type: ENTRY_TYPE;
  name: string;
}

// get all files' paths from drop items
async function recurse(
  list: (FileDropItem | DirectoryDropItem)[] | AsyncIterable<FileDropItem | DirectoryDropItem>,
  filePathList: string[],
) {
  for await (const item of list) {
    if (item.kind === 'file') {
      const file = await item.getFile();
      const path = window.webUtils.getPathForFile(file);
      if (validImportExtensions.some(ext => path.endsWith(`.${ext}`))) {
        filePathList.push(path);
      }
    } else {
      await recurse(item.getEntries(), filePathList);
    }
  }
}

const FileField: FC = () => {
  const id = useId();
  const dropRef = useRef<HTMLLabelElement>(null);
  // files and directories user selected
  const [entryList, setEntryList] = useState<Entry[]>([]);
  // files' path to submit
  const [filePathList, setFilePathList] = useState<string[]>([]);
  const filePaths = useMemo(() => JSON.stringify(filePathList), [filePathList]);
  const { isDropTarget, dropProps } = useDrop({
    ref: dropRef,
    onDrop: async event => {
      const list = event.items.filter(item => item.kind === 'file' || item.kind === 'directory');
      setEntryList(
        list.map(item => ({ type: item.kind === 'file' ? ENTRY_TYPE.FILE : ENTRY_TYPE.DIR, name: item.name })),
      );
      const filePathList: string[] = [];
      await recurse(list, filePathList);
      setFilePathList(filePathList);
    },
  });
  const accept = useMemo(() => validImportExtensions.map(ext => `.${ext}`).join(','), []);
  return (
    <div>
      <input
        className="hidden"
        data-test-id="import-file-input"
        onChange={e => {
          const files = e.target.files;
          if (files) {
            const fileList = Array.from(files);
            setEntryList(fileList.map(file => ({ type: ENTRY_TYPE.FILE, name: file.name })));
            // Electron has added a path attribute to the File interface which exposes the file's real path on filesystem.
            // https://www.electronjs.org/docs/latest/api/file-object
            setFilePathList(fileList.map(file => window.webUtils.getPathForFile(file)));
          } else {
            setEntryList([]);
            setFilePathList([]);
          }
        }}
        accept={accept}
        id={id}
        type="file"
        multiple
      />
      <label
        {...dropProps}
        className={classNames(
          'flex max-h-[50vh] flex-wrap items-center gap-(--padding-sm) overflow-auto rounded-md border border-solid bg-(--hl-xs) p-(--padding-sm)',
          {
            'border-(--color-surprise)': isDropTarget,
            'border-(--hl-md)': !isDropTarget,
          },
        )}
        htmlFor={id}
      >
        <input type="hidden" name="filePaths" value={filePaths} />
        {filePathList.length ? (
          <div className="flex w-full flex-col items-center justify-start gap-(--padding-sm) rounded-md bg-(--color-bg) p-(--padding-md) text-ellipsis whitespace-nowrap">
            {entryList.map(({ name, type }) => (
              <div key={name}>
                <Icon icon={type === ENTRY_TYPE.DIR ? 'folder' : 'file'} className="mr-1" />
                {name}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex w-full flex-col items-center justify-center gap-(--padding-sm) p-(--padding-md)">
            <div>
              <i className="fa fa-upload fa-xl" />
            </div>
            <div>
              Drag and Drop or <span className="text-(--color-surprise)">Choose Files</span> to import
            </div>
          </div>
        )}
      </label>
    </div>
  );
};

export interface ImportSource {
  type: ImportSourceType;
  origin?: string;
  defaultValue?: string;
  endpoint?: string;
  operationId?: string;
  autoScan?: boolean;
  startedAt?: number;
}

interface ImportModalProps extends ModalProps {
  organizationId: string;
  projectName?: string;
  // undefined when not using preferences
  workspaceName?: string;
  // undefined when logged out, should not happen
  defaultProjectId: string;
  // undefined when in workspace selection page
  defaultWorkspaceId?: string;
  from: ImportSource;
}

export const ImportModal: FC<ImportModalProps> = ({
  projectName,
  workspaceName,
  defaultProjectId,
  defaultWorkspaceId,
  organizationId,
  from,
  onHide,
}) => {
  const modalRef = useRef<ModalHandle>(null);
  const scanResourcesFetcher = useScanResourcesFetcher();
  const scanResourcesFetcherData = scanResourcesFetcher.data;
  const importFetcher = useImportResourcesFetcher();
  const navigate = useNavigate();
  const autoScan = from.autoScan ?? false;
  useEffect(() => {
    if (modalRef?.current?.isOpen()) {
      return;
    }
    modalRef.current?.show();
    // the only import types that can be auto-scanned are uri (spec), curl, and mcp
    if (autoScan && !scanResourcesFetcherData && scanResourcesFetcher.state === 'idle') {
      const fd: FormData = new FormData();
      fd.append('source', from.type);
      if (from.type === 'uri') {
        fd.append('uri', from.defaultValue || '');
      } else if (from.type === 'curl') {
        fd.append('curl', from.defaultValue || '');
      } else if (from.type === 'mcp') {
        fd.append('mcp', from.defaultValue || '');
      }
      scanResourcesFetcher.submit(fd);
    }
  }, [autoScan, from.type, from.defaultValue, scanResourcesFetcher, scanResourcesFetcherData]);

  const hasApiSpecScanResult = scanResourcesFetcherData?.some(isApiSpecScanResult);
  const [showForm, setShowForm] = useState(!autoScan);
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);
  const dupCheckRef = useRef(false);
  useEffect(() => {
    if (!autoScan || !hasApiSpecScanResult || !organizationId) return;
    if (!defaultProjectId) {
      setShowForm(true);
      return;
    }
    if (dupCheckRef.current) return;
    const valid = scanResourcesFetcherData?.some(({ errors }) => !errors.length);
    if (!valid) return;
    dupCheckRef.current = true;
    findExistingImportedSpec(defaultProjectId, organizationId).then(existing => {
      if (!existing) return setShowForm(true);
      findRequestInExistingWorkspace(existing.workspace, from.endpoint, from.operationId).then(req => {
        const targetProjectId = existing.workspace.parentId || defaultProjectId;
        const path = req
          ? `/organization/${organizationId}/project/${targetProjectId}/workspace/${existing.workspace._id}/debug/request/${req._id}`
          : `/organization/${organizationId}/project/${targetProjectId}/workspace/${existing.workspace._id}/${models.workspace.scopeToActivity(existing.workspace.scope)}`;
        clearResourceCache();
        navigate(path);
        modalRef.current?.hide();
      });
    });
  }, [
    autoScan,
    defaultProjectId,
    from.endpoint,
    from.operationId,
    hasApiSpecScanResult,
    navigate,
    organizationId,
    scanResourcesFetcherData,
  ]);

  // Track the import completion event, redirect to the new workspace and close the modal
  useEffect(() => {
    if (importFetcher?.data?.done === true && scanResourcesFetcherData?.length) {
      trackImportEvent(AnalyticsEvent.importCompleted, {
        workspaces: scanResourcesFetcherData.map(scanResult => scanResult.workspaces?.length || 0),
        requests: scanResourcesFetcherData.map(scanResult => scanResult.requests?.length || 0),
      });
      const workspace = importFetcher?.data?.singleImportedWorkspace;
      const request = importFetcher?.data?.singleImportedRequest;
      const targetProjectId = importFetcher?.data?.singleImportedProjectId || createdProjectId || defaultProjectId;
      const attribution = readPendingImportAttribution();
      if ((attribution.importSource || attribution.importSourceUrl) && request) {
        window.localStorage.setItem(importAttributionKey(request._id), JSON.stringify(attribution));
      }
      window.sessionStorage.removeItem(PENDING_IMPORT_ATTRIBUTION_KEY);
      if (workspace && request) {
        navigate(
          `/organization/${organizationId}/project/${targetProjectId}/workspace/${workspace._id}/debug/request/${request._id}`,
        );
        return modalRef.current?.hide();
      }
      if (workspace) {
        navigate(
          `/organization/${organizationId}/project/${targetProjectId}/workspace/${workspace._id}/${models.workspace.scopeToActivity(workspace.scope)}`,
        );
        return modalRef.current?.hide();
      }
      navigate(`/organization/${organizationId}/project/${targetProjectId}`);
      modalRef.current?.hide();
    }
  }, [
    createdProjectId,
    defaultProjectId,
    defaultWorkspaceId,
    importFetcher?.data,
    navigate,
    organizationId,
    scanResourcesFetcherData,
  ]);
  // allow workspace import if there is only one workspace
  const totalWorkspacesCount = useMemo(() => {
    return (
      scanResourcesFetcherData?.reduce(
        (accumulator, scanResult) => accumulator + (scanResult.workspaces?.length || 0),
        0,
      ) || 0
    );
  }, [scanResourcesFetcherData]);
  const shouldImportToWorkspace = !!defaultWorkspaceId && totalWorkspacesCount <= 1 && !hasApiSpecScanResult;
  // Check if base environment is being imported to existing workspace
  const isImportingBaseEnvironmentToWorkspace =
    shouldImportToWorkspace &&
    scanResourcesFetcherData?.some(data =>
      data.environments?.some(env => env.parentId && env.parentId.startsWith('__WORKSPACE_ID__')),
    );
  // TODO: need to add a more strong way to inform users that resources will be imported into project rather than current workspace
  const header = shouldImportToWorkspace
    ? `Import to "${workspaceName}" Workspace`
    : projectName
      ? `Import to "${projectName}" Project`
      : 'Import';
  const isScratchPad =
    defaultProjectId &&
    models.project.isScratchpadProject({
      _id: defaultProjectId,
    });

  const cannotImportToWorkspace = totalWorkspacesCount > 1 && isScratchPad;

  const importErrors = [
    ...(importFetcher.data?.errors || []),
    ...(cannotImportToWorkspace
      ? ['Cannot import multiple files to ScratchPad. Please try to import your files one by one.']
      : []),
  ];

  const hasAnyDataToImport = useMemo(() => {
    return scanResourcesFetcherData && scanResourcesFetcherData.some(({ errors }) => errors.length === 0);
  }, [scanResourcesFetcherData]);

  return (
    <OverlayContainer onClick={e => e.stopPropagation()}>
      <Modal ref={modalRef} onHide={onHide}>
        <ModalHeader>{header}</ModalHeader>
        {autoScan && hasApiSpecScanResult && hasAnyDataToImport && !showForm ? (
          <div className="flex items-center justify-center p-8">
            <i className="fa fa-spinner fa-spin fa-2x" />
          </div>
        ) : hasAnyDataToImport ? (
          <ImportResourcesForm
            scanResults={scanResourcesFetcherData as ScanResult[]}
            errors={importErrors}
            loading={importFetcher.state !== 'idle'}
            disabled={importErrors.length > 0}
            isImportingBaseEnvironmentToWorkspace={!!isImportingBaseEnvironmentToWorkspace}
            onImport={async (
              overrideBaseEnvironmentData: boolean,
              selectedProjectId?: string,
              selectedWorkspaceId?: string,
              newProjectName?: string,
            ) => {
              invariant(Array.isArray(scanResourcesFetcherData));

              let targetProjectId = selectedProjectId || defaultProjectId || '';

              if (newProjectName) {
                const createdProjectId = await createProject(organizationId, {
                  storageType: 'local',
                  name: newProjectName,
                });
                if (createdProjectId) {
                  targetProjectId = createdProjectId;
                  setCreatedProjectId(createdProjectId);
                }
              }

              importFetcher.submit({
                organizationId,
                projectId: targetProjectId,
                workspaceId: hasApiSpecScanResult
                  ? undefined
                  : selectedWorkspaceId || (shouldImportToWorkspace ? defaultWorkspaceId : undefined),
                endpoint: from.endpoint,
                operationId: from.operationId,
                skipImportIfDuplicate: autoScan,
                options: {
                  overrideBaseEnvironmentData,
                },
              });
              scanResourcesFetcherData
                .filter(({ errors }) => errors.length === 0)
                .forEach(scanResult => {
                  const type = scanResult.type?.id ?? 'unknown';
                  trackImportEvent(AnalyticsEvent.dataImport, { 'data-import-type': type });
                });
            }}
          />
        ) : autoScan && scanResourcesFetcher.state === 'loading' ? (
          <div className="flex items-center justify-center p-8">
            <i className="fa fa-spinner fa-spin fa-2x" />
          </div>
        ) : (
          <ScanResourcesForm
            from={from}
            scanResults={scanResourcesFetcherData}
            onSubmit={e => {
              e.preventDefault();

              scanResourcesFetcher.submit(e.currentTarget);
            }}
            loading={scanResourcesFetcher.state !== 'idle'}
          />
        )}
      </Modal>
    </OverlayContainer>
  );
};
export const validateCurl = async (value: string): Promise<{ isValid: boolean; message: string }> => {
  if (!value) {
    return { isValid: false, message: 'Invalid cURL request' };
  }
  try {
    const { data } = await window.main.parseImport({ contentStr: value }, { importerId: 'curl' });
    const importedRequest = data?.resources?.[0];
    return importedRequest.url
      ? { isValid: true, message: `Detected ${importedRequest.method} request to ${importedRequest.url}` }
      : { isValid: false, message: 'Invalid cURL request' };
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const finalMessage = rawMessage.includes('No importers found for file') ? 'Invalid cURL request' : rawMessage;
    console.log('[importer] error', finalMessage);
    return finalMessage.includes('No importers found for file')
      ? { isValid: false, message: 'Invalid cURL request' }
      : { isValid: false, message: finalMessage.replace("Error invoking remote method 'parseImport': Error: ", '') };
  }
};
const ScanResourcesForm = ({
  onSubmit,
  from,
  scanResults,
  loading,
}: {
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  from?: ImportModalProps['from'];
  scanResults?: ScanResult[];
  loading: boolean;
}) => {
  const id = useId();
  const [selectedTab, setSelectedTab] = useState(from?.type || 'uri');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    const fn = async () => {
      const { message: msg } = await validateCurl(from?.type === 'curl' && from.defaultValue ? from.defaultValue : '');
      isMounted && setMessage(msg);
    };
    fn();
    return () => {
      isMounted = false;
    };
  }, [from]);
  const isValidCurl = (selectedTab === 'curl' && message && message.startsWith('Detected')) || selectedTab !== 'curl';
  return (
    <Fragment>
      <div className="flex flex-col overflow-y-auto">
        <form
          aria-label="Import from"
          id={id}
          onSubmit={onSubmit}
          method="post"
          className="flex flex-col gap-(--padding-sm)"
        >
          <fieldset className="flex flex-col gap-(--padding-md)">
            <div className="flex rounded-md border border-solid border-(--hl-md) bg-(--hl-xs) p-(--padding-xs)">
              <Radio
                onChange={() => setSelectedTab('file')}
                name="source"
                value="file"
                checked={selectedTab === 'file'}
              >
                <i className="fa fa-plus" />
                File
              </Radio>
              <Radio onChange={() => setSelectedTab('uri')} name="source" value="uri" checked={selectedTab === 'uri'}>
                <i className="fa fa-link" />
                Url
              </Radio>
              <Radio
                onChange={() => setSelectedTab('curl')}
                name="source"
                value="curl"
                checked={selectedTab === 'curl'}
              >
                <CurlIcon />
                cURL
              </Radio>
              <Radio
                onChange={() => setSelectedTab('clipboard')}
                name="source"
                value="clipboard"
                checked={selectedTab === 'clipboard'}
              >
                <i className="fa fa-clipboard" />
                Clipboard
              </Radio>
              <Radio onChange={() => setSelectedTab('mcp')} name="source" value="mcp" checked={selectedTab === 'mcp'}>
                <i className="fa fa-plug" />
                MCP
              </Radio>
            </div>
          </fieldset>
          {selectedTab === 'file' && <FileField />}
          {selectedTab === 'uri' && (
            <div className="form-control form-control--outlined">
              <label>
                Url
                <input
                  type="text"
                  name="uri"
                  defaultValue={from?.type === 'uri' ? from.defaultValue : undefined}
                  placeholder="https://website.com/insomnia-import.json"
                />
              </label>
            </div>
          )}
          {selectedTab === 'curl' && (
            <div className="form-control form-control--outlined">
              <label>
                cURL
                <textarea
                  className="h-[200px] resize-none font-mono"
                  name="curl"
                  defaultValue={from?.type === 'curl' ? from.defaultValue : undefined}
                  placeholder="curl --request GET --url http://insomnia.rest/"
                  onChange={async event => {
                    const { value } = event.target;
                    const { message: msg } = await validateCurl(value);
                    setMessage(msg);
                  }}
                />
              </label>
            </div>
          )}
          {selectedTab === 'mcp' && (
            <div className="form-control form-control--outlined">
              <label>
                MCP Server URL
                <input
                  type="text"
                  name="mcp"
                  defaultValue={from?.type === 'mcp' && from.defaultValue ? from.defaultValue : ''}
                  placeholder="https://mcp.example.com/mcp"
                />
              </label>
            </div>
          )}
        </form>
        {scanResults && (
          <div className="margin-top-sm max-h-[20vh] overflow-y-auto">
            <ScanResultsTable scanResults={scanResults} />
          </div>
        )}
        {selectedTab === 'curl' && message && (
          <div className={`truncate ${isValidCurl ? '' : 'text-(--color-danger)'}`}>{message}</div>
        )}
        {from?.origin && (
          <div className="flex w-full justify-start py-2">
            from{' '}
            <Link
              className="px-2 font-bold underline"
              onClick={() => {
                window.main.openInBrowser(from.origin || '');
              }}
            >
              {' '}
              {from.origin}{' '}
            </Link>{' '}
            ⚠️
          </div>
        )}
        <div className="mt-4 w-full items-center gap-4 text-wrap outline-hidden">
          ⚠️ Make sure that you trust the import source before continuing.
        </div>
      </div>

      <div className="flex items-end justify-between gap-(--padding-sm)">
        <SupportedFormats />
        <Button
          isDisabled={!isValidCurl}
          variant="contained"
          bg="surprise"
          type="submit"
          form={id}
          className="btn h-10 gap-(--padding-sm)"
        >
          <i className="fa fa-file-import" /> Scan
          {loading && <Icon icon="spinner" className="ml-1 animate-spin" />}
        </Button>
      </div>
    </Fragment>
  );
};

const DEFAULT_NEW_PROJECT_NAME = 'New Project';

const ImportResourcesForm = ({
  onImport,
  scanResults,
  errors,
  disabled,
  loading,
  isImportingBaseEnvironmentToWorkspace,
}: {
  scanResults: ScanResult[];
  errors?: string[];
  onImport: (
    overrideBaseEnvironmentData: boolean,
    selectedProjectId?: string,
    selectedWorkspaceId?: string,
    newProjectName?: string,
  ) => void;
  disabled: boolean;
  loading: boolean;
  isImportingBaseEnvironmentToWorkspace: boolean;
}) => {
  const { organizationId, projectId, workspaceId } = useParams() as {
    organizationId: string;
    projectId: string;
    workspaceId: string;
  };
  const [overrideBaseEnvironmentData, setOverrideBaseEnvironmentData] = useState(true);
  const isSingleRequest = scanResults.length === 1 && (scanResults[0].requests?.length || 0) === 1;
  const workspacesFetcher = useProjectListWorkspacesLoaderFetcher();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(workspaceId || '');
  const [selectedProjectId, setSelectedProjectId] = useState(projectId || '');
  const [newProjectName, setNewProjectName] = useState(() => {
    for (const result of scanResults) {
      if (isApiSpecScanResult(result)) {
        return result.workspaces?.[0]?.name || result.apiSpecs?.[0]?.name || DEFAULT_NEW_PROJECT_NAME;
      }
    }
    return DEFAULT_NEW_PROJECT_NAME;
  });
  useEffect(() => {
    const isIdle = workspacesFetcher.state === 'idle';
    const hasFetchedSelectedProject = selectedProjectId === workspacesFetcher?.data?.activeProject._id;
    const hasDataAndFetchedSelectedProject = workspacesFetcher?.data && hasFetchedSelectedProject;
    const needsFetch = isIdle && !hasDataAndFetchedSelectedProject && selectedProjectId;
    if (needsFetch) {
      workspacesFetcher.load({
        organizationId,
        projectId: selectedProjectId,
      });
    }
  }, [organizationId, projectId, selectedProjectId, workspacesFetcher]);
  // List collections for active project, sorted by last modified timestamp descending
  // Should we list design or mcp?
  const selectedNewProject = !selectedProjectId;
  const workspacesForActiveProject = selectedNewProject
    ? []
    : workspacesFetcher?.data?.files
        .toSorted((a, b) => b.lastModifiedTimestamp - a.lastModifiedTimestamp)
        .map(w => ({ ...w.workspace, lastModifiedTimestamp: w.lastModifiedTimestamp }))
        .filter(isNotNullOrUndefined)
        .filter(w => w.scope === 'collection' || w.scope === 'design') || [];
  const shouldShowWorkspaceSelect = isSingleRequest && workspacesForActiveProject.length > 0;
  return (
    <Fragment>
      <div className="flex max-h-[50vh] flex-col gap-(--padding-md) overflow-auto">
        <div className="overflow-y-auto">
          <ScanResultsTable scanResults={scanResults} />
          <div className="form-row mt-2">
            <div className="form-control form-control--outlined">
              <label>
                Select Project:
                <select
                  aria-label="Select Project"
                  name="projectId"
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                >
                  <option value="">-- New Project --</option>
                  {workspacesFetcher?.data?.projects.map(w => (
                    <option key={w._id} value={w._id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          {selectedNewProject && (
            <div className="mt-2">
              <div className="form-control form-control--outlined">
                <label>
                  New Project Name:
                  <input
                    type="text"
                    name="newProjectName"
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    placeholder="Enter project name"
                  />
                </label>
              </div>
              <p className="mt-1 text-xs text-[--color-help]">
                New project will be created as Local. You can change the type later in project settings.
              </p>
            </div>
          )}
          {shouldShowWorkspaceSelect && (
            <div className="form-row mt-2">
              <div className="form-control form-control--outlined">
                <label>
                  Select Collection:
                  <select
                    aria-label="Select Collection"
                    name="workspaceId"
                    value={selectedWorkspaceId}
                    onChange={e => setSelectedWorkspaceId(e.target.value)}
                  >
                    <option value="">-- New Collection --</option>
                    {workspacesForActiveProject.map(w => (
                      <option key={w._id} value={w._id}>
                        {w.name} - {formatDistanceToNowStrict(w.lastModifiedTimestamp)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          )}
          <div className="mt-4 w-full items-center gap-4 text-wrap outline-hidden">
            ⚠️ Make sure that you trust the import source before continuing.
          </div>
          {isImportingBaseEnvironmentToWorkspace && (
            <Checkbox
              isSelected={overrideBaseEnvironmentData}
              onChange={checked => setOverrideBaseEnvironmentData(checked)}
              className="mt-1"
            >
              Override Base Environment On Name Conflict
              <HelpTooltip className="space-left">
                Override existing variables in the base environment if the same variable names are found during import.
              </HelpTooltip>
            </Checkbox>
          )}
        </div>

        <div>
          {errors && errors.length > 0 && (
            <div className="notice error margin-top-sm">
              <Heading className="font-bold">Error while importing to Insomnia:</Heading>
              <p>{errors[0]}</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex w-full items-end justify-end gap-(--padding-sm)">
        <Button
          variant="contained"
          bg="surprise"
          disabled={disabled || loading}
          onClick={() =>
            onImport(
              overrideBaseEnvironmentData,
              selectedProjectId,
              selectedWorkspaceId,
              selectedNewProject ? newProjectName || 'New Project' : undefined,
            )
          }
          className="btn h-10 gap-(--padding-sm)"
        >
          {loading ? (
            <div>
              <i className="fa fa-spinner fa-spin" /> Importing
            </div>
          ) : (
            <div>
              <i className="fa fa-file-import" /> Import
            </div>
          )}
        </Button>
      </div>
    </Fragment>
  );
};

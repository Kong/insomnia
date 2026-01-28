import classNames from 'classnames';
import { formatDistanceToNowStrict } from 'date-fns';
import React, { type FC, Fragment, type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { type DirectoryDropItem, type FileDropItem, OverlayContainer, useDrop } from 'react-aria';
import { Heading } from 'react-aria-components';
import { useNavigate, useParams } from 'react-router';

import { isNotNullOrUndefined } from '~/common/misc';
import { scopeToActivity } from '~/models/workspace';
import { useImportResourcesFetcher } from '~/routes/import.resources';
import { useScanResourcesFetcher } from '~/routes/import.scan';
import { useProjectListWorkspacesLoaderFetcher } from '~/routes/organization.$organizationId.project.$projectId.list-workspaces';
import { Checkbox } from '~/ui/components/base/checkbox';

import type { ScanResult } from '../../../../common/import';
import { isScratchpadProject } from '../../../../models/project';
import { invariant } from '../../../../utils/invariant';
import { SegmentEvent } from '../../../analytics';
import { Modal, type ModalHandle, type ModalProps } from '../../base/modal';
import { ModalHeader } from '../../base/modal-header';
import { HelpTooltip } from '../../help-tooltip';
import { Icon } from '../../icon';
import { Button } from '../../themed-button';
import { CurlIcon, disclaimer, ScanResultsTable, SupportedFormats, validImportExtensions } from './shared';

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

interface ImportModalProps extends ModalProps {
  organizationId: string;
  projectName: string;
  // undefined when not using preferences
  workspaceName?: string;
  // undefined when logged out, should not happen
  defaultProjectId: string;
  // undefined when in workspace selection page
  defaultWorkspaceId?: string;
  from:
    | {
        type: 'file';
      }
    | {
        type: 'uri';
        defaultValue?: string;
      }
    | {
        type: 'curl';
        defaultValue?: string;
      }
    | {
        type: 'clipboard';
      };
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
  useEffect(() => {
    modalRef.current?.show();
  }, []);

  // Track the import completion event, redirect to the new workspace and close the modal
  useEffect(() => {
    if (importFetcher?.data?.done === true && scanResourcesFetcherData?.length) {
      window.main.trackSegmentEvent({
        event: SegmentEvent.importCompleted,
        properties: {
          workspaces: scanResourcesFetcherData.map(scanResult => scanResult.workspaces?.length || 0),
          requests: scanResourcesFetcherData.map(scanResult => scanResult.requests?.length || 0),
        },
      });
      const workspace = importFetcher?.data?.singleImportedWorkspace;
      const request = importFetcher?.data?.singleImportedRequest;
      if (workspace && request) {
        navigate(
          `/organization/${organizationId}/project/${defaultProjectId}/workspace/${workspace._id}/debug/request/${request._id}`,
        );
        return modalRef.current?.hide();
      }
      if (workspace) {
        navigate(
          `/organization/${organizationId}/project/${defaultProjectId}/workspace/${workspace._id}/${scopeToActivity(workspace.scope)}`,
        );
        return modalRef.current?.hide();
      }
      navigate(`/organization/${organizationId}/project/${defaultProjectId}`);
      modalRef.current?.hide();
    }
  }, [defaultProjectId, defaultWorkspaceId, importFetcher?.data, navigate, organizationId, scanResourcesFetcherData]);
  // allow workspace import if there is only one workspace
  const totalWorkspacesCount = useMemo(() => {
    return (
      scanResourcesFetcherData?.reduce(
        (accumulator, scanResult) => accumulator + (scanResult.workspaces?.length || 0),
        0,
      ) || 0
    );
  }, [scanResourcesFetcherData]);
  const shouldImportToWorkspace = !!defaultWorkspaceId && totalWorkspacesCount <= 1;
  // Check if base environment is being imported to existing workspace
  const isImportingBaseEnvironmentToWorkspace =
    shouldImportToWorkspace &&
    scanResourcesFetcherData?.some(data =>
      data.environments?.some(env => env.parentId && env.parentId.startsWith('__WORKSPACE_ID__')),
    );
  // TODO: need to add a more strong way to inform users that resources will be imported into project rather than current workspace
  const header = shouldImportToWorkspace
    ? `Import to "${workspaceName}" Workspace`
    : `Import to "${projectName}" Project`;
  const isScratchPad =
    defaultProjectId &&
    isScratchpadProject({
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
        {hasAnyDataToImport ? (
          <ImportResourcesForm
            scanResults={scanResourcesFetcherData as ScanResult[]}
            errors={importErrors}
            loading={importFetcher.state !== 'idle'}
            disabled={importErrors.length > 0}
            isImportingBaseEnvironmentToWorkspace={!!isImportingBaseEnvironmentToWorkspace}
            onImport={(overrideBaseEnvironmentData: boolean, selectedWorkspaceId?: string) => {
              invariant(Array.isArray(scanResourcesFetcherData));

              importFetcher.submit({
                organizationId,
                projectId: defaultProjectId || '',
                workspaceId: selectedWorkspaceId || (shouldImportToWorkspace ? defaultWorkspaceId : undefined),
                options: {
                  overrideBaseEnvironmentData,
                },
              });
              scanResourcesFetcherData
                .filter(({ errors }) => errors.length === 0)
                .forEach(scanResult => {
                  const type = scanResult.type?.id ?? 'unknown';
                  window.main.trackSegmentEvent({
                    event: SegmentEvent.dataImport,
                    properties: { 'data-import-type': type },
                  });
                });
            }}
          />
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
  const [importFrom, setImportFrom] = useState(from?.type || 'uri');

  return (
    <Fragment>
      <div className="flex flex-col">
        <form
          aria-label="Import from"
          id={id}
          onSubmit={onSubmit}
          method="post"
          className="flex flex-col gap-(--padding-sm)"
        >
          <fieldset className="flex flex-col gap-(--padding-md)">
            <div className="flex rounded-md border border-solid border-(--hl-md) bg-(--hl-xs) p-(--padding-xs)">
              <Radio onChange={() => setImportFrom('file')} name="source" value="file" checked={importFrom === 'file'}>
                <i className="fa fa-plus" />
                File
              </Radio>
              <Radio onChange={() => setImportFrom('uri')} name="source" value="uri" checked={importFrom === 'uri'}>
                <i className="fa fa-link" />
                Url
              </Radio>
              <Radio onChange={() => setImportFrom('curl')} name="source" value="curl" checked={importFrom === 'curl'}>
                <CurlIcon />
                cURL
              </Radio>
              <Radio
                onChange={() => setImportFrom('clipboard')}
                name="source"
                value="clipboard"
                checked={importFrom === 'clipboard'}
              >
                <i className="fa fa-clipboard" />
                Clipboard
              </Radio>
            </div>
          </fieldset>
          {importFrom === 'file' && <FileField />}
          {importFrom === 'uri' && (
            <div className="form-control form-control--outlined">
              <label>
                Url:
                <input
                  type="text"
                  name="uri"
                  defaultValue={from?.type === 'uri' ? from.defaultValue : undefined}
                  placeholder="https://website.com/insomnia-import.json"
                />
              </label>
            </div>
          )}
          {importFrom === 'curl' && (
            <div className="form-control form-control--outlined">
              <label>
                cURL:
                <input
                  type="text"
                  name="curl"
                  defaultValue={from?.type === 'curl' ? from.defaultValue : undefined}
                  placeholder="curl --request GET --url http://insomnia.rest/"
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
      </div>
      <div className="flex items-end justify-between gap-(--padding-sm)">
        <SupportedFormats />
        <Button variant="contained" bg="surprise" type="submit" form={id} className="btn h-10 gap-(--padding-sm)">
          <i className="fa fa-file-import" /> Scan
          {loading && <Icon icon="spinner" className="ml-[4px] animate-spin" />}
        </Button>
      </div>
    </Fragment>
  );
};

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
  onImport: (overrideBaseEnvironmentData: boolean, selectedWorkspaceId?: string) => void;
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
  useEffect(() => {
    const isIdleAndUninitialized = workspacesFetcher.state === 'idle' && !workspacesFetcher.data;
    if (isIdleAndUninitialized) {
      workspacesFetcher.load({
        organizationId,
        projectId,
      });
    }
  }, [organizationId, projectId, workspacesFetcher]);
  // List collections for active project, sorted by last modified timestamp descending
  // Should we list design or mcp?
  const workspacesForActiveProject =
    workspacesFetcher?.data?.files
      .toSorted((a, b) => b.lastModifiedTimestamp - a.lastModifiedTimestamp)
      .map(w => ({ ...w.workspace, lastModifiedTimestamp: w.lastModifiedTimestamp }))
      .filter(isNotNullOrUndefined)
      .filter(w => w.scope === 'collection' || w.scope === 'design') || [];
  const shouldShowWorkspaceSelect = !workspaceId && isSingleRequest && workspacesForActiveProject.length > 0;
  return (
    <Fragment>
      <div className="flex max-h-[50vh] flex-col gap-(--padding-md) overflow-auto">
        <div className="overflow-y-auto">
          <ScanResultsTable scanResults={scanResults} />
          {shouldShowWorkspaceSelect && (
            <div className="form-row mt-2">
              <div className="form-control form-control--outlined">
                <label>
                  Select Workspace:
                  <select
                    aria-label="Select Workspace"
                    name="workspaceId"
                    value={selectedWorkspaceId}
                    onChange={e => setSelectedWorkspaceId(e.target.value)}
                  >
                    <option value="">-- New Workspace --</option>
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

      <div className="flex w-full items-end justify-between gap-(--padding-sm)">
        <div>
          <div className="pb-(--padding-sm)">{disclaimer}</div>
        </div>
        <Button
          variant="contained"
          bg="surprise"
          disabled={disabled}
          onClick={() => onImport(overrideBaseEnvironmentData, selectedWorkspaceId)}
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

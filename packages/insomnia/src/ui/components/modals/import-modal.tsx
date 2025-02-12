import classNames from 'classnames';
import React, {
  type FC,
  Fragment,
  type PropsWithChildren,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type DirectoryDropItem, type FileDropItem, OverlayContainer, useDrop } from 'react-aria';
import { Heading } from 'react-aria-components';
import { useFetcher } from 'react-router-dom';

import type { ScanResult } from '../../../common/import';
import { isScratchpadProject } from '../../../models/project';
import { invariant } from '../../../utils/invariant';
import { SegmentEvent } from '../../analytics';
import type { ImportResourcesActionResult } from '../../routes/import';
import { Modal, type ModalHandle, type ModalProps } from '../base/modal';
import { ModalHeader } from '../base/modal-header';
import { Icon } from '../icon';
import { Button } from '../themed-button';

const Pill: FC<PropsWithChildren> = ({ children }) => (
  <div
    className="flex items-center gap-[var(--padding-xs)] p-[var(--padding-sm)] rounded-[var(--radius-md)] text-[length:var(--font-size-xs)]"
  >
    {children}
  </div>
);

const Radio: FC<{
  name: string;
  value: string;
  children: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}> = ({ name, value, onChange, children, checked, defaultChecked }) => {
  const id = useId();
  return (
    <div className="has-[:checked]:bg-[--color-bg]">
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
        className="absolute w-px h-px overflow-hidden whitespace-nowrap -m-px p-0 border-0"
      />
      <label
        className="p-[var(--padding-sm)] rounded-[var(--radius-md)] flex items-center gap-[var(--padding-sm)]"
        data-test-id={`import-from-${value}`}
        htmlFor={id}
      >{children}</label>
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
async function recurse(list: (FileDropItem | DirectoryDropItem)[] | AsyncIterable<FileDropItem | DirectoryDropItem>, filePathList: string[]) {
  for await (const item of list) {
    if (item.kind === 'file') {
      const path = (await item.getFile()).path;
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
      setEntryList(list.map(item => ({ type: item.kind === 'file' ? ENTRY_TYPE.FILE : ENTRY_TYPE.DIR, name: item.name })));
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
          'p-[var(--padding-sm)] rounded-[var(--radius-md)] flex items-center gap-[var(--padding-sm)] bg-[color:var(--hl-xs)] flex-wrap border border-solid',
          {
            'border-[color:var(--color-surprise)]': isDropTarget,
            'border-[color:var(--hl-md)]': !isDropTarget,
          }
        )}
        htmlFor={id}
      >
        <input type="hidden" name="filePaths" value={filePaths} />
        {filePathList.length ? (<div
          className="bg-[color:var(--color-bg)] rounded-[var(--radius-md)] text-ellipsis overflow-hidden whitespace-nowrap flex flex-col items-center justify-center p-[var(--padding-md)] gap-[var(--padding-sm)] w-full"
        >
          {entryList.map(({ name, type }) => (
            <div
              key={name}
            >
              <Icon
                icon={type === ENTRY_TYPE.DIR ? 'folder' : 'file'}
                className="mr-1"
              />
              {name}
            </div>
          ))}
        </div>) : (
            <div
              className="flex flex-col items-center justify-center p-[var(--padding-md)] gap-[var(--padding-sm)] w-full"
            >
              <div>
                <i className="fa fa-upload fa-xl" />
              </div>
              <div>
                Drag and Drop or{' '}
                <span
                  className="text-[color:var(--color-surprise)]"
                >
                  Choose Files
                </span>{' '}
                to import
              </div>
            </div>
        )}
      </label>
    </div>
  );
};

const InsomniaIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={18}
      height={18}
      viewBox="0 0 32 32"
      fill="none"
      {...props}
    >
      <path
        d="M16 31.186c8.387 0 15.186-6.799 15.186-15.186S24.387.814 16 .814.814 7.613.814 16 7.613 31.186 16 31.186z"
        fill="var(--color-bg)"
      />
      <path
        d="M16 0C7.163 0 0 7.163 0 16s7.163 16 16 16 16-7.163 16-16S24.837 0 16 0zm0 1.627c7.938 0 14.373 6.435 14.373 14.373S23.938 30.373 16 30.373 1.627 23.938 1.627 16 8.062 1.627 16 1.627z"
        fill="var(--color-font)"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M16.18 4.61c6.291 0 11.39 5.1 11.39 11.39 0 6.29-5.099 11.39-11.39 11.39-6.29 0-11.39-5.1-11.39-11.39 0-1.537.305-3.004.858-4.342a4.43 4.43 0 106.192-6.192 11.357 11.357 0 014.34-.856z"
        fill="var(--color-font)"
      />
      <defs>
        <linearGradient
          id="paint0_linear"
          x1={16.1807}
          y1={27.3898}
          x2={16.1807}
          y2={4.61017}
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#7400E1" />
          <stop offset={1} stopColor="#4000BF" />
        </linearGradient>
      </defs>
    </svg>
  );
};

const SwaggerIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18px"
      height="18px"
      viewBox="0 0 256 256"
      {...props}
    >
      <path
        fill="var(--color-font)"
        d="M127.999 249.895c-67.215 0-121.9-54.68-121.9-121.896C6.1 60.782 60.785 6.102 128 6.102c67.214 0 121.899 54.685 121.899 121.9 0 67.214-54.685 121.893-121.9 121.893z"
      />
      <path
        fill="var(--color-bg)"
        d="M127.999 12.202c63.954 0 115.797 51.842 115.797 115.797 0 63.952-51.843 115.797-115.797 115.797-63.952 0-115.797-51.845-115.797-115.797S64.047 12.202 127.999 12.202m0-12.202C57.419 0 0 57.42 0 127.999s57.42 127.998 127.999 127.998S256 198.577 256 128C256 57.419 198.578 0 127.999 0z"
      />
      <path
        fill="var(--color-bg)"
        d="M80.598 86.619c-.394 4.38.146 8.909-.146 13.338-.345 4.431-.887 8.811-1.773 13.192-1.23 6.25-5.12 10.976-10.482 14.914 10.436 6.793 11.616 17.324 12.304 28.006.345 5.76.197 11.567.788 17.276.443 4.429 2.165 5.562 6.745 5.708 1.87.048 3.786 0 5.956 0v13.683c-13.535 2.313-24.708-1.525-27.467-12.992-.887-4.184-1.478-8.467-1.673-12.798-.297-4.578.195-9.155-.148-13.732-.985-12.553-2.61-16.785-14.618-17.376v-15.602a23.714 23.714 0 012.608-.443c6.596-.345 9.4-2.364 10.828-8.86.69-3.641 1.084-7.333 1.23-11.074.494-7.136.297-14.42 1.525-21.507C67.997 68.163 74.3 63.24 84.785 62.65c2.952-.149 5.955 0 9.35 0v13.98c-1.427.1-2.658.294-3.937.294-8.515-.297-8.96 2.607-9.6 9.695zm16.39 32.386h-.196c-4.923-.245-9.155 3.593-9.403 8.515-.246 4.972 3.592 9.206 8.515 9.45h.59c4.875.296 9.056-3.447 9.352-8.319v-.491c.1-4.971-3.886-9.055-8.857-9.155zm30.862 0c-4.774-.148-8.763 3.593-8.909 8.318 0 .297 0 .543.051.837 0 5.365 3.641 8.812 9.155 8.812 5.414 0 8.812-3.544 8.812-9.106-.051-5.366-3.646-8.91-9.109-8.86zm31.602 0c-5.02-.1-9.206 3.89-9.352 8.91a9.03 9.03 0 009.055 9.054h.1c4.528.788 9.106-3.592 9.402-8.858.243-4.874-4.186-9.106-9.205-9.106zm43.363.737c-5.711-.245-8.567-2.164-9.992-7.581a54.874 54.874 0 01-1.624-10.582c-.395-6.596-.346-13.241-.789-19.837-1.033-15.651-12.352-21.114-28.794-18.41V76.92c2.607 0 4.626 0 6.645.049 3.495.048 6.153 1.379 6.496 5.268.345 3.543.345 7.136.69 10.73.692 7.139 1.083 14.372 2.314 21.41 1.085 5.809 5.07 10.14 10.04 13.684-8.71 5.857-11.27 14.223-11.714 23.626-.245 6.448-.394 12.944-.736 19.443-.297 5.905-2.362 7.824-8.318 7.972-1.674.05-3.298.198-5.169.297v13.93c3.495 0 6.694.196 9.892 0 9.942-.592 15.947-5.415 17.918-15.063a125.582 125.582 0 001.476-16.045c.343-4.923.297-9.894.788-14.766.737-7.63 4.232-10.78 11.862-11.27.739-.1 1.427-.246 2.118-.492v-15.604c-1.282-.149-2.17-.295-3.103-.346z"
      />
    </svg>
  );
};

const OpenAPIIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={17}
      height={17}
      viewBox="0 0 512 512"
      {...props}
    >
      <path
        fill="currentColor"
        d="M.204 294.376l135.073-.002a91.735 91.735 0 008.452 30.17L27.94 394.298C12.75 368.103 3.166 334.783.204 294.376zm131.802 196.803l51.407-124.841a91.475 91.475 0 01-14.938-9.955l-95.47 95.472c19.49 17.557 39.562 30.71 59.001 39.324zm-65.604-45.647l95.284-95.286c-4.933-4.963-9.482-10.85-13.667-17.616L32.512 402.213c10.491 17.069 22.148 31.847 33.89 43.319zm313.997 6.327l-95.53-95.525a91.813 91.813 0 01-3.184 2.466l69.71 115.72c9.73-6.055 19.39-13.823 29.004-22.66zm-36.74 27.532l-69.565-115.479c-25.964 14.5-53.318 17.553-82.406 6.337l-51.301 124.583c70.2 28.467 142.961 20.313 203.272-15.441zM171.713 211.67L102.005 95.95c-10.164 6.523-19.819 14.106-29.006 22.66l95.527 95.527a135.39 135.39 0 013.187-2.467zM0 285.236l134.762-.002c.291-23.838 8.71-45.682 26.928-65.006l-95.287-95.287C22.416 171.553.512 225.056 0 285.236zm226.694-91.938L226.7 58.54c-44.728.274-84.005 12.326-116.96 32.539l69.563 115.48c13.077-7.677 28.664-12.98 47.39-13.26zm186.404-37.118l-99.449 99.452a93.73 93.73 0 014.453 20.46h135.09c-.883-40.98-14.404-80.939-40.094-119.912zm40.28 129.052H318.631c-.468 25.24-9.9 48.244-26.924 65.014l95.29 95.286c43.82-43.123 65.122-96.948 66.381-160.3zM235.84 58.74l-.006 135.087c7.082.802 13.883 2.342 20.466 4.455l99.415-99.415c-35.132-24.575-76.54-38.362-119.875-40.127zM430.95 2.597c-39.165 11.457-55.533 55.183-38.782 88.672L254.808 228.63c-32.407-16.157-74.902-1.57-87.795 36.034-15.716 45.84 24.243 91.802 71.754 82.533 42.01-8.196 62.31-54.188 44.466-90.01L420.722 119.7c34.66 17.226 79.533-1.065 89.396-41.654 11.43-47.037-32.658-89.054-79.168-75.449z"
      />
    </svg>
  );
};

const CurlIcon = (props: React.SVGProps<SVGSVGElement>) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={18}
      height={18}
      viewBox="0 0 123.184 102.926"
      {...props}
    >
      <defs>
        <symbol overflow="visible">
          <path
            d="M73.36 0v-84.172H13.233V0zm-9.626-78.156L43.297-47.5 22.844-78.156zm3.61 66.734L46.89-42.094 67.344-72.75zm-44.5 5.406l20.453-30.656L63.734-6.016zm-3.61-66.734l20.453 30.656-20.453 30.672zm0 0"
            stroke="none"
          />
        </symbol>
        <symbol overflow="visible">
          <path
            d="M15.031-26.813c0 7.094 1.328 10.579 6.86 15.141l8.53 7.11C35.829-.125 38.595 0 45.329 0H63.61c3.844 0 7.938-.844 7.938-5.766 0-5.062-4.563-5.78-7.938-5.78H43.297c-2.297 0-4.578-1.204-6.625-2.892l-6.969-5.89c-1.812-1.438-3.125-2.64-3.125-4.922v-14.313c0-2.28 1.313-3.484 3.125-4.937l6.969-5.89c2.047-1.672 4.328-2.876 6.625-2.876h20.312c3.375 0 7.938-.734 7.938-5.78 0-4.923-4.094-5.767-7.938-5.767H45.33c-6.735 0-9.5.126-14.907 4.563l-8.531 7.094c-5.532 4.578-6.86 8.062-6.86 15.156zm0 0"
            stroke="none"
          />
        </symbol>
        <symbol overflow="visible">
          <path
            d="M71.547-56.875c0-3.969-.844-7.938-5.766-7.938-4.937 0-5.781 3.97-5.781 7.938v33.547L43.047-12.625c-1.078.719-2.281 1.078-3.61 1.078h-3.843c-2.766 0-5.766-.719-6.735-2.406-.968-1.672-1.078-4.813-1.203-7.453l-1.203-35.469c-.125-3.734-.719-7.938-5.656-7.938-5.281 0-5.89 4.454-5.766 8.657l1.203 36.312c.235 6.25.125 11.188 5.297 15.64C25.375-.968 28.984 0 32.234 0h8.532c3.125 0 6.25-1.438 9.984-3.844l9.375-6.14v1.921c0 3.97.844 8.063 5.766 8.063 6.14 0 5.656-5.89 5.656-8.531zm0 0"
            stroke="none"
          />
        </symbol>
        <symbol overflow="visible">
          <path
            d="M15.031-7.938c0 3.97.844 7.938 5.766 7.938 4.937 0 5.781-3.969 5.781-7.938v-29.218L42.688-50.5c2.046-1.688 3.609-2.766 5.765-2.766h3.375c2.766 0 5.531 0 6.969 2.047C60-49.547 60-48.094 60-46.172c0 3.719 1.688 7.094 5.89 7.094 4.938 0 5.657-4.094 5.657-8.063 0-5.28-1.328-9.25-5.172-13.109-3.125-3.125-6.844-4.563-11.297-4.563h-9.266c-3.609 0-6.968 2.282-10.218 4.922l-9.016 7.47v-4.704c0-3.844-1.203-7.688-5.781-7.688-5.281 0-5.766 4.329-5.766 8.532zm0 0"
            stroke="none"
          />
        </symbol>
        <symbol overflow="visible">
          <path
            d="M49.297-80.563c0-6.859-1.922-8.062-8.531-8.062H28.625c-3.86 0-7.938.844-7.938 5.766 0 5.062 4.563 5.78 7.938 5.78h9.14v65.532h-9.14c-3.86 0-7.938.844-7.938 5.781C20.688-.719 25.25 0 28.625 0h29.328c3.375 0 7.938-.719 7.938-5.766 0-4.937-4.079-5.78-7.938-5.78h-8.656zm0 0"
            stroke="none"
          />
        </symbol>
      </defs>
      <path
        d="M114.102 14.043a4.96 4.96 0 01-4.961-4.961 4.958 4.958 0 014.96-4.96 4.96 4.96 0 110 9.921M64.833 98.805a4.96 4.96 0 01-4.96-4.961 4.958 4.958 0 014.96-4.961 4.957 4.957 0 014.957 4.96 4.96 4.96 0 01-4.957 4.962M114.102 0a9.082 9.082 0 00-9.082 9.082c0 1.07.27 2.066.609 3.02L63.023 85.125c-4.117.863-7.273 4.344-7.273 8.719a9.082 9.082 0 009.082 9.082c5.012 0 9.078-4.067 9.078-9.082 0-1.008-.27-1.93-.57-2.836l42.82-73.262c3.992-.957 7.024-4.379 7.024-8.664A9.082 9.082 0 00114.102 0"
        fill="currentColor"
        fillOpacity={1}
        fillRule="nonzero"
        stroke="none"
      />
      <path
        d="M76.941 14.043a4.96 4.96 0 01-4.96-4.961 4.958 4.958 0 014.96-4.96 4.957 4.957 0 014.957 4.96 4.96 4.96 0 01-4.957 4.961M27.668 98.805a4.96 4.96 0 110-9.922 4.958 4.958 0 014.96 4.96 4.96 4.96 0 01-4.96 4.962M76.941 0a9.08 9.08 0 00-9.082 9.082c0 1.07.27 2.066.61 3.02L25.863 85.125c-4.12.863-7.277 4.344-7.277 8.719a9.082 9.082 0 0018.164 0c0-1.008-.27-1.93-.57-2.836L79 17.746c3.992-.957 7.023-4.379 7.023-8.664 0-5.016-4.07-9.082-9.082-9.082M9.082 29.227a4.963 4.963 0 014.961 4.96 4.96 4.96 0 11-4.96-4.96M9.081 43.27a9.082 9.082 0 009.082-9.082c0-1.004-.273-1.93-.574-2.836-1.203-3.606-4.5-6.247-8.508-6.247-.64 0-1.203.239-1.809.368C3.156 26.332 0 29.813 0 34.188a9.082 9.082 0 009.082 9.082M4.121 65.922a4.96 4.96 0 119.922 0 4.96 4.96 0 01-4.961 4.957 4.96 4.96 0 01-4.96-4.957m14.042 0c0-1.008-.273-1.93-.574-2.836-1.203-3.606-4.496-6.246-8.508-6.246-.64 0-1.203.238-1.809.363C3.156 58.066 0 61.547 0 65.922c0 5.012 4.066 9.082 9.082 9.082 5.016 0 9.082-4.07 9.082-9.082"
        fill="currentColor"
        fillOpacity={1}
        fillRule="nonzero"
        stroke="none"
      />
    </svg>
  );
};

interface ImportModalProps extends ModalProps {
  organizationId: string;
  projectName: string;
  // undefined when not using preferences
  workspaceName?: string;
  // undefined when using insomnia://app/import
  defaultProjectId?: string;
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
    type: 'clipboard';
  };
}

const validImportExtensions = [
  'sh',
  'txt',
  'json',
  'har',
  'curl',
  'bash',
  'shell',
  'yaml',
  'yml',
  'wsdl',
  'zip',
];

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
  const scanResourcesFetcher = useFetcher<ScanResult[]>();
  const scanResourcesFetcherData = scanResourcesFetcher.data;
  const importFetcher = useFetcher<ImportResourcesActionResult>();
  useEffect(() => {
    modalRef.current?.show();
  }, []);

  useEffect(() => {
    if (importFetcher?.data?.done === true) {
      modalRef.current?.hide();
    }
  }, [importFetcher.data]);
  // allow workspace import if there is only one workspace
  const totalWorkspacesCount = useMemo(() => {
    return scanResourcesFetcherData?.reduce((accumulator, scanResult) => accumulator + (scanResult.workspaces?.length || 0), 0) || 0;
  }, [scanResourcesFetcherData]);
  const shouldImportToWorkspace = !!defaultWorkspaceId && totalWorkspacesCount <= 1;
  // TODO: need to add a more strong way to inform users that resources will be imported into project rather than current workspace
  const header = shouldImportToWorkspace ? `Import to "${workspaceName}" Workspace` : `Import to "${projectName}" Project`;
  const isScratchPad = defaultProjectId && isScratchpadProject({
    _id: defaultProjectId,
  });

  const cannotImportToWorkspace = totalWorkspacesCount > 1 && isScratchPad;

  const importErrors = [
    ...(importFetcher.data?.errors || []),
    ...cannotImportToWorkspace ? ['Cannot import multiple files to ScratchPad. Please try to import your files one by one.'] : [],
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
            organizationId={organizationId}
            defaultProjectId={defaultProjectId}
            defaultWorkspaceId={shouldImportToWorkspace ? defaultWorkspaceId : ''}
            scanResults={scanResourcesFetcherData as ScanResult[]}
            errors={importErrors}
            loading={importFetcher.state !== 'idle'}
            disabled={importErrors.length > 0}
            onSubmit={e => {
              invariant(Array.isArray(scanResourcesFetcherData));
              e.preventDefault();
              // file://./../../routes/import.tsx#importResourcesAction
              importFetcher.submit(e.currentTarget, {
                method: 'post',
                action: '/import/resources',
              });
              scanResourcesFetcherData.filter(({ errors }) => errors.length === 0).forEach(scanResult => {
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
                // file://./../../routes/import.tsx#scanForResourcesAction
                scanResourcesFetcher.submit(e.currentTarget, {
                  method: 'post',
                  action: '/import/scan',
                });
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
      <div
        className='flex flex-col'
      >
        <form
          aria-label="Import from"
          id={id}
          onSubmit={onSubmit}
          method="post"
          className='flex flex-col gap-[var(--padding-sm)]'
        >
          <fieldset
            className='flex flex-col gap-[var(--padding-md)]'
          >
            <div
              className='flex p-[var(--padding-xs)] border border-[color:var(--hl-md)] rounded-[var(--radius-md)] bg-[color:var(--hl-xs)] border-solid'
            >
              <Radio
                onChange={() => setImportFrom('file')}
                name="importFrom"
                value="file"
                checked={importFrom === 'file'}
              >
                <i className="fa fa-plus" />
                File
              </Radio>
              <Radio
                onChange={() => setImportFrom('uri')}
                name="importFrom"
                value="uri"
                checked={importFrom === 'uri'}
              >
                <i className="fa fa-link" />
                Url
              </Radio>
              <Radio
                onChange={() => setImportFrom('clipboard')}
                name="importFrom"
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
        </form>
        {scanResults && (
          <div className='margin-top-sm overflow-y-auto'>
            <ScanResultsTable scanResults={scanResults} />
          </div>
        )}
      </div>
      <div
        className='flex gap-[var(--padding-sm)] justify-between items-end'
      >
        <div>
          <div
            className='pb-[var(--padding-sm)]'
          >
            Supported Formats
          </div>
          <div
            className='flex flex-wrap gap-[var(--padding-sm)]'
          >
            <Pill>
              <InsomniaIcon />
              Insomnia
            </Pill>
            <Pill>
              <i className="fa-regular fa-file fa-lg" />
              Postman
            </Pill>
            <Pill>
              <SwaggerIcon />
              Swagger
            </Pill>
            <Pill>
              <OpenAPIIcon />
              OpenAPI
            </Pill>
            <Pill>
              <CurlIcon />
              cURL
            </Pill>
            <Pill>
              <i className="fa-regular fa-file fa-lg" />
              HAR
            </Pill>
            <Pill>
              <i className="fa-regular fa-file fa-lg" />
              WSDL
            </Pill>
          </div>
        </div>
        <Button
          variant="contained"
          bg="surprise"
          type="submit"
          form={id}
          className="btn h-10 gap-[var(--padding-sm)]"
        >
          <i className="fa fa-file-import" /> Scan
          {loading && (<Icon icon="spinner" className="animate-spin ml-[4px]" />)}
        </Button>
      </div>
    </Fragment>
  );
};

const ImportResourcesForm = ({
  scanResults,
  defaultProjectId,
  defaultWorkspaceId,
  organizationId,
  onSubmit,
  errors,
  disabled,
  loading,
}: {
    scanResults: ScanResult[];
  organizationId: string;
  defaultProjectId?: string;
  defaultWorkspaceId?: string;
  errors?: string[];
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  disabled: boolean;
    loading: boolean;
}
) => {
  const id = useId();
  return (
    <Fragment>
      <div
        className='flex flex-col gap-[var(--padding-md)]'
      >
        <form
          onSubmit={onSubmit}
          method="post"
          action="/import/resources"
          id={id}
          className='hidden'
        >
          <input hidden name="organizationId" readOnly value={organizationId} />
          <input hidden name="projectId" readOnly value={defaultProjectId} />
          <input hidden name="workspaceId" readOnly value={defaultWorkspaceId} />
        </form>
        <div
          className='overflow-y-auto'
        >
          <ScanResultsTable scanResults={scanResults} />
        </div>
        <div>
          {errors && errors.length > 0 && (
            <div className="notice error margin-top-sm">
              <Heading className='font-bold'>Error while importing to Insomnia:</Heading>
              <p>{errors[0]}</p>
            </div>
          )}
        </div>
      </div>

      <div
        className='flex gap-[var(--padding-sm)] w-full justify-between items-end'
      >
        <div>
          <div
            className='pb-[var(--padding-sm)]'
          >
            Insomnia provides features that may automatically execute code. Only import files from trusted sources.
          </div>
        </div>
        <Button
          variant="contained"
          bg="surprise"
          type="submit"
          disabled={disabled}
          form={id}
          className="btn h-10 gap-[var(--padding-sm)]"
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

const ScanResultsTable = ({ scanResults }: { scanResults: ScanResult[] }) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const keyRandom = useMemo(() => Math.random(), [scanResults]);
  return (
    <table className="table--fancy table--outlined">
      <tbody>
        {scanResults.map((scanResult, idx) => {
          const uniqueKey = `${keyRandom}${idx}`;
          const hasErrors = scanResult.errors.length > 0;
          return (
            <React.Fragment key={uniqueKey}>
              <tr className="table--no-outline-row">
                <td className="bg-[color:var(--hl-xxs)]">
                  <div
                    className={classNames({
                      'text-danger': hasErrors,
                    }, 'flex items-center gap-[var(--padding-sm)]')}
                  >
                    {hasErrors ? (
                      <Fragment>
                        <i className="fa-regular fa-file fa-lg" />
                        Parse file {scanResult.oriFileName} failed, this file will not be imported:
                      </Fragment>
                    ) : (
                      <Fragment>
                        {getImporterSign(scanResult)}{' '}resources to be imported from {scanResult.oriFileName}:
                      </Fragment>
                    )}
                  </div>
                </td>
              </tr>
              {hasErrors ? (
                <tr>
                  <td>
                    <ul
                      className={classNames({
                        'text-danger': hasErrors,
                      })}
                    >
                      {scanResult.errors.map((error, idx) => {
                        const key = `${uniqueKey}${scanResult.oriFileName}${idx}`;
                        return (
                          <li key={key}>{error}</li>
                        );
                      })}
                    </ul>
                  </td>
                </tr>
              ) : (
                <Fragment>
                  {scanResult.workspaces && scanResult.workspaces?.length > 0 && (
                    <tr
                      key={scanResult.workspaces[0]._id}
                      className="table--no-outline-row"
                    >
                      <td>
                        {scanResult.workspaces.length}{' '}
                        {scanResult.workspaces.length === 1 ? 'Workspace' : 'Workspaces'}
                      </td>
                    </tr>
                  )}
                  {scanResult.requests && scanResult.requests?.length > 0 && (
                    <tr
                      key={scanResult.requests[0]._id}
                      className="table--no-outline-row"
                    >
                      <td>
                        {scanResult.requests.length}{' '}
                        {scanResult.requests.length === 1 ? 'Request' : 'Requests'}
                      </td>
                    </tr>
                  )}
                  {scanResult.apiSpecs && scanResult.apiSpecs?.length > 0 && (
                    <tr
                      key={scanResult.apiSpecs[0]._id}
                      className="table--no-outline-row"
                    >
                      <td>
                          <div className="flex items-center gap-[var(--padding-md)]">
                          {scanResult.apiSpecs.length}{' '}
                          {scanResult.apiSpecs.length === 1 ? 'OpenAPI Spec' : 'OpenAPI Specs'}
                        </div>
                      </td>
                    </tr>
                  )}
                  {scanResult.environments &&
                    scanResult.environments.length > 0 && (
                      <tr className="table--no-outline-row">
                        <td>
                          {scanResult.environments.length}{' '}
                          {scanResult.environments.length === 1
                            ? 'Environment'
                            : 'Environments'}
                          {' with '}
                          {scanResult.cookieJars?.length}{' '}
                          {scanResult.cookieJars?.length === 1 ? 'Cookie Jar' : 'Cookie Jars'}
                        </td>
                      </tr>
                    )}
                  {scanResult.unitTestSuites &&
                    scanResult.unitTestSuites?.length > 0 && (
                      <tr className="table--no-outline-row">
                        <td>
                          {scanResult.unitTestSuites.length}{' '}
                          {scanResult.unitTestSuites.length === 1
                            ? 'Test Suite'
                            : 'Test Suites'}
                          {' with '}
                          {scanResult.unitTests?.length}
                          {scanResult.unitTests?.length === 1 ? ' Test' : ' Tests'}
                        </td>
                      </tr>
                    )}
                  {scanResult.mockRoutes &&
                    scanResult.mockRoutes?.length > 0 && (
                      <tr className="table--no-outline-row">
                        <td>
                          {scanResult.mockRoutes?.length}{' '}
                          {scanResult.mockRoutes?.length === 1
                            ? 'Mock Route'
                            : 'Mock Routes'}
                        </td>
                      </tr>
                    )}
                </Fragment>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );
};

function getImporterSign(scanResult: ScanResult) {
  let name = '';
  let icon = null;
  if (scanResult.type?.id) {
    const id = scanResult.type.id;
    if (id.includes('insomnia')) {
      icon = (<InsomniaIcon width={24} height={24} />);
      name = 'Insomnia';
    } else if (id.includes('postman')) {
      icon = (<i className="fa-regular fa-file fa-lg" />);
      name = 'Postman';
    } else if (id.includes('swagger')) {
      icon = (<SwaggerIcon width={24} height={24} />);
      name = 'Swagger';
    } else if (id.includes('openapi')) {
      icon = (<OpenAPIIcon width={24} height={24} />);
      name = 'OpenAPI';
    } else if (id.includes('wsdl')) {
      icon = (<i className="fa-regular fa-file fa-lg" />);
      name = 'WSDL';
    } else if (id.includes('har')) {
      icon = (<i className="fa-regular fa-file fa-lg" />);
      name = 'HAR';
    } else if (id.includes('curl')) {
      icon = (<CurlIcon width={24} height={24} />);
      name = 'cURL';
    }
  }
  return (<Fragment>{icon}{name}</Fragment>);
}

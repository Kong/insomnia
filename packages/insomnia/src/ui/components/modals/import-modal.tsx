import React, {
  FC,
  Fragment,
  ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { useFetcher } from 'react-router-dom';
import styled from 'styled-components';

import { strings } from '../../../common/strings';
import {
  isDefaultProject,
  isLocalProject,
  Project,
} from '../../../models/project';
import { Workspace } from '../../../models/workspace';
import { Modal, ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';

interface ImportModalProps extends ModalProps {
  defaultProjectId: string;
  defaultWorkspaceId?: string;
  projects: Project[];
  from: 'file' | 'uri' | 'clipboard';
}

const RadioGroup = styled.div({
  display: 'flex',
  padding: 'var(--padding-xs)',
  border: '1px solid var(--hl-md)',
  borderRadius: 'var(--radius-md)',
  backgroundColor: 'var(--hl-xs)',
  'input[type="radio"]:checked ~ label': {
    backgroundColor: 'var(--color-bg)',
    boxShadow: '0 0 5px 1px var(--hl-xs)',
  },
});

const RadioLabel = styled.label({
  padding: 'var(--padding-sm)',
  borderRadius: 'var(--radius-md)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--padding-sm)',
});

const RadioInput = styled.input({
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: '0',
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
  borderWidth: '0',
});

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
    <div>
      <RadioInput
        id={id}
        type="radio"
        name={name}
        checked={checked}
        value={value}
        defaultChecked={defaultChecked}
        onChange={onChange}
      />
      <RadioLabel htmlFor={id}>{children}</RadioLabel>
    </div>
  );
};

const Fieldset = styled.fieldset({
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--padding-md)',
  legend: {
    marginBottom: 'var(--padding-xs)',
  },
});

const FileInput = styled.input({
  display: 'none',
});

const FileInputLabel = styled.label({
  padding: 'var(--padding-sm)',
  borderRadius: 'var(--radius-md)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--padding-sm)',
  border: '1px solid var(--hl-md)',
  backgroundColor: 'var(--hl-xs)',
  flexWrap: 'wrap',
});

const FileView = styled.div({
  backgroundColor: 'var(--color-bg)',
  padding: 'var(--padding-xs)',
  borderRadius: 'var(--radius-md)',
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
});

const FileField: FC = () => {
  const id = useId();
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);

  return (
    <div>
      <FileInput
        onChange={e => setSelectedFiles(e.currentTarget.files)}
        accept={[
          '',
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
        ].join(',')}
        id={id}
        type="file"
        multiple
      />
      <FileInputLabel htmlFor={id}>
        <Fragment>
          {selectedFiles?.length
            ? [...selectedFiles].map(file => {
              return (
                <Fragment key={file.name}>
                  <FileView key={file.path}>
                    <i className="fa fa-file" />
                    {file.name}
                  </FileView>
                  <input type="hidden" name="filePath" value={file.path} />
                </Fragment>
              );
            })
            : 'Choose Files'}
        </Fragment>
      </FileInputLabel>
    </div>
  );
};

export const ImportModal: FC<ImportModalProps> = ({
  projects,
  defaultProjectId,
  defaultWorkspaceId,
  from,
  ...modalProps
}) => {
  const modalRef = useRef<ModalHandle>(null);
  const { data, state, submit, load } = useFetcher();

  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(
    defaultWorkspaceId || 'create-new-workspace-id'
  );

  const [importFrom, setImportFrom] = useState(from || 'uri');

  const newWorkspace = {
    _id: 'create-new-workspace-id',
    name: '+ Create New Workspace',
  };

  const workspaces: Workspace[] = [...(data?.workspaces ?? []), newWorkspace];

  useEffect(() => {
    modalRef.current?.show();
    if (defaultProjectId && state === 'idle' && !data) {
      load(`/project/${defaultProjectId}`);
    }
  }, [data, defaultProjectId, load, state]);

  return (
    <Modal {...modalProps} ref={modalRef}>
      <ModalHeader>{'Import to Insomnia'}</ModalHeader>
      <ModalBody className="wide">
        <form
          onSubmit={e => {
            e.preventDefault();
            submit(e.currentTarget, {
              method: 'post',
              action:`/import/${importFrom}`,
            });
            modalRef.current?.hide();
          }}
          method="post"
          action={`/import/${importFrom}`}
          id="workspace-import-form"
          className="wide pad"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--padding-sm)',
          }}
        >
          <Fieldset>
            <legend>
              <strong>Import from:</strong>
            </legend>
            <RadioGroup>
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
            </RadioGroup>
          </Fieldset>
          {importFrom === 'file' && <FileField />}
          {importFrom === 'uri' && (
            <div className="form-control form-control--outlined">
              <label>
                Url:
                <input type="text" name="uri" placeholder='https://website.com/insomnia-import.json' />
              </label>
            </div>
          )}
          <div className="form-control form-control--outlined">
            <label>
              {strings.project.singular}:
              <select
                onChange={e => load(`/project/${e.currentTarget.value}`)}
                defaultValue={defaultProjectId}
                name="projectId"
              >
                {projects.map(project => (
                  <option key={project._id} value={project._id}>
                    {project.name} (
                    {isDefaultProject(project)
                      ? strings.defaultProject.singular
                      : isLocalProject(project)
                        ? strings.localProject.singular
                        : strings.remoteProject.singular}
                    )
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-control form-control--outlined">
            <label>
              {strings.workspace.singular}:
              <select
                onChange={e => {
                  setSelectedWorkspaceId(e.currentTarget.value);
                }}
                defaultValue={selectedWorkspaceId}
                name="workspaceId"
              >
                {workspaces.map(workspace => (
                  <option key={workspace._id} value={workspace._id}>
                    {workspace.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {selectedWorkspaceId === 'create-new-workspace-id' && (
            <Fragment>
              <div className="form-control form-control--outlined">
                <label>
                  {strings.workspace.singular} Name:
                  <input type="text" name="name" defaultValue="New Workspace" />
                </label>
              </div>
              <Fieldset>
                <legend>
                  <strong>Import as:</strong>
                </legend>
                <RadioGroup>
                  <Radio defaultChecked name="scope" value="collection">
                    <i className="fa fa-bars" />
                    Collection
                  </Radio>
                  <Radio name="scope" value="design">
                    <i className="fa fa-file-o" />
                    Document
                  </Radio>
                </RadioGroup>
              </Fieldset>
            </Fragment>
          )}
          {<div />}
        </form>
      </ModalBody>
      <ModalFooter>
        <button type="submit" form="workspace-import-form" className="btn">
          Import
        </button>
      </ModalFooter>
    </Modal>
  );
};

import * as protoLoader from '@grpc/proto-loader';
import fs from 'fs';
import path from 'path';
import React, { FC, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';

import { database as db } from '../../../common/database';
import { selectFileOrFolder } from '../../../common/select-file-or-folder';
import * as models from '../../../models';
import { ProtoDirectory } from '../../../models/proto-directory';
import { type ProtoFile, isProtoFile } from '../../../models/proto-file';
import { ProtoDirectoryLoader } from '../../../network/grpc/proto-directory-loader';
import { writeProtoFile } from '../../../network/grpc/write-proto-file';
import { selectExpandedActiveProtoDirectories } from '../../redux/proto-selectors';
import { type ModalHandle, Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { ProtoFileList } from '../proto-file/proto-file-list';
import { AsyncButton } from '../themed-button';
import { showAlert, showError } from '.';
const tryToSelectFilePath = async () => {
  try {
    const { filePath, canceled } = await selectFileOrFolder({ itemTypes: ['file'], extensions: ['proto'] });
    if (!canceled && filePath) {
      return filePath;

    }
  } catch (error) {
    showError({ error });
  }
  return;
};
const tryToSelectFolderPath = async () => {
  try {
    const { filePath, canceled } = await selectFileOrFolder({ itemTypes: ['directory'], extensions: ['proto'] });
    if (!canceled && filePath) {
      return filePath;

    }
  } catch (error) {
    showError({ error });
  }
  return;
};
const isProtofileValid = (filePath:string) => {
  try {
    protoLoader.load(filePath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });
    return true;
  } catch (error) {
    showError({
      title: 'Invalid Proto File',
      message: `The file ${filePath} and could not be parsed`,
      error,
    });
    return false;
  }
};

export interface Props {
  defaultId?: string;
  onSave?: (arg0: string) => Promise<void>;
  onHide: () => void;
  reloadRequests: (requestIds: string[]) => void;
}

export const ProtoFilesModal: FC<Props> = ({ defaultId, onHide, onSave, reloadRequests }) => {
  const modalRef = useRef<ModalHandle>(null);
  const { workspaceId } = useParams() as { workspaceId: string };

  const [selectedId, setSelectedId] = useState(defaultId);

  useEffect(() => {
    modalRef.current?.show();
  }, []);

  const protoDirectories = useSelector(selectExpandedActiveProtoDirectories);

  const handleAddDirectory = async () => {
    let rollback = false;
    let createdIds: string[];
    const bufferId = await db.bufferChangesIndefinitely();
    const filePath = await tryToSelectFolderPath();
    if (!filePath) {
      return;
    }
    try {
      const result = await new ProtoDirectoryLoader(filePath, workspaceId).load();
      createdIds = result.createdIds;
      const { error, createdDir } = result;

      if (error) {
        showError({
          title: 'Failed to import',
          message: `An unexpected error occurred when reading ${filePath}`,
          error,
        });
        rollback = true;
        return;
      }

      // Show warning if no files found
      if (!createdDir) {
        showAlert({
          title: 'No files found',
          message: `No .proto files were found under ${filePath}.`,
        });
        return;
      }

      // Try parse all loaded proto files to make sure they are valid
      const loadedEntities = await db.withDescendants(createdDir);
      const loadedFiles = loadedEntities.filter(isProtoFile);

      for (const protoFile of loadedFiles) {
        try {
          const { filePath, dirs } = await writeProtoFile(protoFile);
          protoLoader.load(filePath, {
            keepCase: true,
            longs: String,
            enums: String,
            defaults: true,
            oneofs: true,
            includeDirs: dirs });
        } catch (error) {
          showError({
            title: 'Invalid Proto File',
            message: `The file ${protoFile.name} could not be parsed`,
            error,
          });
          rollback = true;
          return;
        }
      }
    } catch (error) {
      rollback = true;
      showError({ error });
    } finally {
      // Fake flushing changes (or, rollback) only prevents change notifications being sent to the UI
      // It does NOT revert changes written to the database, as is typical of a db transaction rollback
      // As such, if rolling back, the created directory needs to be deleted manually
      await db.flushChanges(bufferId, rollback);

      if (rollback) {
        // @ts-expect-error -- TSCONVERSION
        await models.protoDirectory.batchRemoveIds(createdIds);
        // @ts-expect-error -- TSCONVERSION
        await models.protoFile.batchRemoveIds(createdIds);
      }
    }
  };
  const handleUpdate = async (protoFile: ProtoFile) => {
    const filePath = await tryToSelectFilePath();
    if (!filePath) {
      return;
    }
    if (!isProtofileValid(filePath)) {
      return;
    }
    const contents = await fs.promises.readFile(filePath, 'utf-8');
    const updatedFile = await models.protoFile.update(protoFile, {
      name: path.basename(filePath),
      protoText: contents,
    });
    const impacted = await models.grpcRequest.findByProtoFileId(updatedFile._id);
    const requestIds = impacted.map(g => g._id);
    if (requestIds?.length) {
      requestIds.forEach(requestId => window.main.grpc.cancel(requestId));
      reloadRequests(requestIds);
    }
  };

  const handleDeleteDirectory = (protoDirectory: ProtoDirectory) => {
    showAlert({
      title: `Delete ${protoDirectory.name}`,
      message: (<span>
        Really delete <strong>{protoDirectory.name}</strong> and all proto files contained within?
        All requests that use these proto files will stop working.
      </span>),
      addCancel: true,
      onConfirm: async () => {
        models.protoDirectory.remove(protoDirectory);
        setSelectedId('');
      },
    });
  };
  const handleDeleteFile = (protoFile: ProtoFile) => {
    showAlert({
      title: `Delete ${protoFile.name}`,
      message: (<span>
        Really delete <strong>{protoFile.name}</strong>? All requests that use this proto file will
        stop working.
      </span>),
      addCancel: true,
      onConfirm: () => {
        models.protoFile.remove(protoFile);
        if (selectedId === protoFile._id) {
          setSelectedId('');
        }
      },
    });
  };
  const handleAddFile = async () => {
    const filePath = await tryToSelectFilePath();
    if (!filePath) {
      return;
    }
    if (!isProtofileValid(filePath)) {
      return;
    }
    const contents = await fs.promises.readFile(filePath, 'utf-8');
    const newFile = await models.protoFile.create({
      name: path.basename(filePath),
      parentId: workspaceId,
      protoText: contents,
    });
    setSelectedId(newFile._id);
  };

  return (
    <Modal ref={modalRef} onHide={onHide}>
      <ModalHeader>Select Proto File</ModalHeader>
      <ModalBody className="wide pad">
        <div className="row-spaced margin-bottom bold">
          Files
          <span>
            <AsyncButton
              className="margin-right-sm"
              onClick={handleAddDirectory}
              loadingNode={<i className="fa fa-spin fa-refresh" />}
            >
              Add Directory
            </AsyncButton>
            <AsyncButton
              onClick={handleAddFile}
              loadingNode={<i className="fa fa-spin fa-refresh" />}
            >
              Add Proto File
            </AsyncButton>
          </span>
        </div>
        <ProtoFileList
          protoDirectories={protoDirectories}
          selectedId={selectedId}
          handleSelect={id => setSelectedId(id)}
          handleUpdate={handleUpdate}
          handleDelete={handleDeleteFile}
          handleDeleteDirectory={handleDeleteDirectory}
        />
      </ModalBody>
      <ModalFooter>
        <div>
          <button
            className="btn"
            onClick={event => {
              event.preventDefault();
              if (typeof onSave === 'function' && selectedId) {
                onSave(selectedId);
              }
            }}
            disabled={!selectedId}
          >
            Save
          </button>
        </div>
      </ModalFooter>
    </Modal >
  );
};

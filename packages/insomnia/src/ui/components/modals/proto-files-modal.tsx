import React, { FC, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import * as models from '../../../models';
import type { ProtoFile } from '../../../models/proto-file';
import * as protoManager from '../../../network/grpc/proto-manager';
import { selectExpandedActiveProtoDirectories } from '../../redux/proto-selectors';
import { selectActiveWorkspace } from '../../redux/selectors';
import { type ModalHandle, Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { ProtoFileList } from '../proto-file/proto-file-list';
import { AsyncButton } from '../themed-button';

export interface Props {
  defaultId?: string;
  onSave?: (arg0: string) => Promise<void>;
  reloadRequests: (requestIds: string[]) => void;
}

export const ProtoFilesModal: FC<Props> = ({ defaultId, onSave, reloadRequests }) => {
  const modalRef = useRef<ModalHandle>(null);

  const [selectedId, setSelectedId] = useState(defaultId);

  useEffect(() => {
    modalRef.current?.show();
  }, []);

  const workspace = useSelector(selectActiveWorkspace);
  const protoDirectories = useSelector(selectExpandedActiveProtoDirectories);

  const selectFile = (selectedId: string) => setSelectedId(selectedId);
  const clearSelection = () => setSelectedId('');

  const handleUpdate = async (protoFile: ProtoFile) => protoManager.updateFile(protoFile, async updatedId => {
    const impacted = await models.grpcRequest.findByProtoFileId(updatedId);
    const requestIds = impacted.map(g => g._id);
    if (requestIds?.length) {
      requestIds.forEach(requestId => window.main.grpc.cancel(requestId));
      reloadRequests(requestIds);
    }
  });

  if (!workspace) {
    return null;
  }
  return (
    <Modal ref={modalRef}>
      <ModalHeader>Select Proto File</ModalHeader>
      <ModalBody className="wide pad">
        <div className="row-spaced margin-bottom bold">
          Files
          <span>
            <AsyncButton
              className="margin-right-sm"
              onClick={() => protoManager.addDirectory(workspace._id)}
              loadingNode={<i className="fa fa-spin fa-refresh" />}
            >
              Add Directory
            </AsyncButton>
            <AsyncButton
              onClick={() => protoManager.addFile(workspace._id, selectFile)}
              loadingNode={<i className="fa fa-spin fa-refresh" />}
            >
              Add Proto File
            </AsyncButton>
          </span>
        </div>
        <ProtoFileList
          protoDirectories={protoDirectories}
          selectedId={selectedId}
          handleSelect={selectFile}
          handleUpdate={handleUpdate}
          handleRename={(protoFile: ProtoFile, name?: string) => protoManager.renameFile(protoFile, name)}
          handleDelete={protoFile => protoManager.deleteFile(protoFile, deletedId => {
            if (selectedId === deletedId) {
              clearSelection();
            }
          })
          }
          handleDeleteDirectory={protoDirectory => protoManager.deleteDirectory(protoDirectory, deletedIds => {
            if (selectedId && deletedIds.includes(selectedId)) {
              clearSelection();
            }
          })}
        />
      </ModalBody>
      <ModalFooter>
        <div>
          <button
            className="btn"
            onClick={event => {
              event.preventDefault();
              modalRef.current?.hide();
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

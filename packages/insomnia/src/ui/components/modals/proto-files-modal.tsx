import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { GrpcRequestEventEnum } from '../../../common/grpc-events';
import type { ProtoFile } from '../../../models/proto-file';
import * as protoManager from '../../../network/grpc/proto-manager';
import type { GrpcDispatch } from '../../context/grpc';
import { grpcActions, sendGrpcIpcMultiple } from '../../context/grpc';
import { selectExpandedActiveProtoDirectories } from '../../redux/proto-selectors';
import { selectActiveWorkspace } from '../../redux/selectors';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { ProtoFileList } from '../proto-file/proto-file-list';
import { AsyncButton } from '../themed-button';

export interface ProtoFilesModalOptions {
  selectedId?: string;
  onSave?: (arg0: string) => Promise<void>;
}
export interface ProtoFilesModalHandle {
  show: (options: ProtoFilesModalOptions) => void;
  hide: () => void;
}
type Props = ModalProps & { grpcDispatch: GrpcDispatch };
export const ProtoFilesModal = forwardRef<ProtoFilesModalHandle, Props>(({ grpcDispatch }, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<ProtoFilesModalOptions>({
    selectedId: '',
  });

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: ({ onSave, selectedId }) => {
      setState({ onSave, selectedId });
      modalRef.current?.show();
    },
  }), []);

  const workspace = useSelector(selectActiveWorkspace);
  const protoDirectories = useSelector(selectExpandedActiveProtoDirectories);

  const selectFile = (selectedId: string) => setState({ selectedId, onSave: state.onSave });
  const clearSelection = () => setState({ selectedId: '', onSave: state.onSave });

  const handleUpdate = async (protoFile: ProtoFile) => protoManager.updateFile(protoFile, async updatedId => {
    const action = await grpcActions.invalidateMany(updatedId);
    grpcDispatch(action);
    sendGrpcIpcMultiple(GrpcRequestEventEnum.cancelMultiple, action?.requestIds);
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
          selectedId={state.selectedId}
          handleSelect={selectFile}
          handleUpdate={handleUpdate}
          handleRename={(protoFile: ProtoFile, name?: string) => protoManager.renameFile(protoFile, name)}
          handleDelete={protoFile => protoManager.deleteFile(protoFile, deletedId => {
            if (state.selectedId === deletedId) {
              clearSelection();
            }
          })
          }
          handleDeleteDirectory={protoDirectory => protoManager.deleteDirectory(protoDirectory, deletedIds => {
            if (state.selectedId && deletedIds.includes(state.selectedId)) {
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
              if (typeof state.onSave === 'function' && state.selectedId) {
                state.onSave(state.selectedId);
              }
            }}
            disabled={!state.selectedId}
          >
            Save
          </button>
        </div>
      </ModalFooter>
    </Modal >
  );
});
ProtoFilesModal.displayName = 'ProtoFilesModal';

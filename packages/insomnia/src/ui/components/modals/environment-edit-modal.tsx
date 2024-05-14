import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import { RequestGroup } from '../../../models/request-group';
import { useRequestGroupPatcher } from '../../hooks/use-request';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { EnvironmentEditor, EnvironmentEditorHandle } from '../editors/environment-editor';

interface State {
  requestGroup: RequestGroup | null;
}

export interface EnvironmentEditModalOptions {
  requestGroup: RequestGroup;
}
export interface EnvironmentEditModalHandle {
  show: (options: EnvironmentEditModalOptions) => void;
  hide: () => void;
}
export const EnvironmentEditModal = forwardRef<EnvironmentEditModalHandle, ModalProps>((props, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const environmentEditorRef = useRef<EnvironmentEditorHandle>(null);
  const [state, setState] = useState<State>({
    requestGroup: null,
  });

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: ({ requestGroup }) => {
      setState(state => ({ ...state, requestGroup }));
      modalRef.current?.show();
    },
  }), []);

  const patchGroup = useRequestGroupPatcher();
  const { requestGroup } = state;
  const environmentInfo = {
    object: requestGroup ? requestGroup.environment : {},
    propertyOrder: requestGroup && requestGroup.environmentPropertyOrder,
  };

  const saveChanges = () => {
    setState({ requestGroup });
    if (environmentEditorRef.current?.isValid()) {
      try {
        const data = environmentEditorRef.current?.getValue();
        if (state.requestGroup && data) {
          patchGroup(state.requestGroup._id, {
            environment: data.object,
            environmentPropertyOrder: data.propertyOrder,
          });
        }
      } catch (err) {
        console.warn('Failed to update environment', err);
      }
    }

  };

  return (
    <Modal ref={modalRef} tall {...props} onHide={saveChanges}>
      <ModalHeader>Environment Overrides (JSON Format)</ModalHeader>
      <ModalBody noScroll className="pad-top-sm">
        <EnvironmentEditor
          ref={environmentEditorRef}
          key={requestGroup ? requestGroup._id : 'n/a'}
          environmentInfo={environmentInfo}
          onBlur={saveChanges}
        />
      </ModalBody>
      <ModalFooter>
        <div className="margin-left italic txt-sm">
          * Used to override data in the global environment
        </div>
        <button className="btn" onClick={() => modalRef.current?.hide()}>
          Close
        </button>
      </ModalFooter>
    </Modal >
  );
});
EnvironmentEditModal.displayName = 'EnvironmentEditModal';

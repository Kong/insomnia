import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import * as models from '../../../models/index';
import { RequestGroup } from '../../../models/request-group';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { EnvironmentEditor, EnvironmentEditorHandle } from '../editors/environment-editor';

interface State {
  requestGroup: RequestGroup | null;
  isValid: boolean;
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
  const editorRef = useRef<EnvironmentEditorHandle>(null);
  const [state, setState] = useState<State>({
    requestGroup: null,
    isValid: true,
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
  const didChange = () => {
    const isValid = editorRef.current?.isValid() || false;
    setState({ isValid, requestGroup });
    if (!isValid) {
      return;
    }
    try {
      const data = editorRef.current?.getValue();
      if (state.requestGroup && data) {
        models.requestGroup.update(state.requestGroup, {
          environment: data.object,
          environmentPropertyOrder: data.propertyOrder,
        });
      }
    } catch (err) {
      // Invalid JSON probably
      return;
    }
  };
  const { requestGroup, isValid } = state;
  const environmentInfo = {
    object: requestGroup ? requestGroup.environment : {},
    propertyOrder: requestGroup && requestGroup.environmentPropertyOrder,
  };
  return (
    <Modal ref={modalRef} tall {...props}>
      <ModalHeader>Environment Overrides (JSON Format)</ModalHeader>
      <ModalBody noScroll className="pad-top-sm">
        <EnvironmentEditor
          ref={editorRef}
          key={requestGroup ? requestGroup._id : 'n/a'}
          environmentInfo={environmentInfo}
          didChange={didChange}
        />
      </ModalBody>
      <ModalFooter>
        <div className="margin-left italic txt-sm">
          * Used to override data in the global environment
        </div>
        <button className="btn" disabled={!isValid} onClick={() => modalRef.current?.hide()}>
          Done
        </button>
      </ModalFooter>
    </Modal >
  );
});
EnvironmentEditModal.displayName = 'EnvironmentEditModal';

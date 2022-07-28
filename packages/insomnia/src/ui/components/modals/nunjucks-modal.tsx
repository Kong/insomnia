import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { Workspace } from '../../../models/workspace';
import { Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { TagEditor } from '../templating/tag-editor';
import { VariableEditor } from '../templating/variable-editor';

interface Props {
  uniqueKey: string;
  workspace: Workspace;
}

interface NunjucksModalOptions {
  template: string;
  onDone: Function;
}

export interface NunjucksModalHandle {
  show: (options: NunjucksModalOptions) => void;
  hide: () => void;
}
export const NunjucksModal = forwardRef<NunjucksModalHandle, ModalProps & Props>((props, ref) => {
  const modalRef = useRef<Modal>(null);
  const [state, setState] = useState<NunjucksModalOptions>({
    template: '',
    onDone: () => { },
  });

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: ({ onDone, template }) => {
      setState({
        template,
        onDone,
      });
      modalRef.current?.show();
    },
  }), []);

  const _handleTemplateChange = (template: string) => {
    setState({
      template,
      onDone: state.onDone,
    });
  };

  const _handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    modalRef.current?.hide();
  };

  const _handleModalHide = () => {
    state.onDone(state.template);

    setState({
      template: '',
      onDone: state.onDone,
    });
  };
  const { uniqueKey, workspace } = props;
  const { template } = state;
  let editor: JSX.Element | null = null;
  let title = '';

  if (template.indexOf('{{') === 0) {
    title = 'Variable';
    editor = <VariableEditor onChange={_handleTemplateChange} defaultValue={template} />;
  } else if (template.indexOf('{%') === 0) {
    title = 'Tag';
    editor = <TagEditor onChange={_handleTemplateChange} defaultValue={template} workspace={workspace} />;
  }

  return (
    <Modal ref={modalRef} onHide={_handleModalHide} key={uniqueKey}>
      <ModalHeader>Edit {title}</ModalHeader>
      <ModalBody className="pad" key={template}>
        <form onSubmit={_handleSubmit}>{editor}</form>
      </ModalBody>
      <ModalFooter>
        <button className="btn" onClick={() => modalRef.current?.hide()}>
          Done
        </button>
      </ModalFooter>
    </Modal>
  );
});
NunjucksModal.displayName = 'NunjucksModal';

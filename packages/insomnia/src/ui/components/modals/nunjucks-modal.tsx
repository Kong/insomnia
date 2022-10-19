import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import { Workspace } from '../../../models/workspace';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { TagEditor } from '../templating/tag-editor';
import { VariableEditor } from '../templating/variable-editor';

interface Props {
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
  const modalRef = useRef<ModalHandle>(null);
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

  const handleTemplateChange = (template: string) => {
    setState(state => ({
      template,
      onDone: state.onDone,
    }));
  };

  const { workspace } = props;
  const { template } = state;
  let editor: JSX.Element | null = null;
  let title = '';

  if (template.indexOf('{{') === 0) {
    title = 'Variable';
    editor = <VariableEditor onChange={handleTemplateChange} defaultValue={template} />;
  } else if (template.indexOf('{%') === 0) {
    title = 'Tag';
    editor = <TagEditor onChange={handleTemplateChange} defaultValue={template} workspace={workspace} />;
  }
  return (
    <Modal
      ref={modalRef}
      onHide={() => {
        state.onDone(state.template);
        setState(state => ({
          template: '',
          onDone: state.onDone,
        }));
      }}
    >
      <ModalHeader>Edit {title}</ModalHeader>
      <ModalBody className="pad">
        <form
          onSubmit={event => {
            event.preventDefault();
            modalRef.current?.hide();
          }}
        >{editor}</form>
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

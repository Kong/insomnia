import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import type { Workspace } from '../../../models/workspace';
import { Modal, type ModalHandle, type ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { TagEditor } from '../templating/tag-editor';
import { VariableEditor } from '../templating/variable-editor';

interface Props {
  workspace: Workspace;
}

interface State {
  isTag: boolean;
  template: string;
  onDone: Function;
  editorId?: string;
}

interface NunjucksModalOptions {
  template: string;
  onDone: Function;
  editorId?: string;
}

export interface NunjucksModalHandle {
  show: (options: NunjucksModalOptions) => void;
  hide: () => void;
}
export const NunjucksModal = forwardRef<NunjucksModalHandle, ModalProps & Props>((props, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<State>({
    isTag: false,
    template: '',
    onDone: () => { },
    editorId: '',
  });

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: ({ onDone, template, editorId }) => {
      setState({
        isTag: template.indexOf('{%') === 0,
        template,
        onDone,
        editorId,
      });
      modalRef.current?.show();
    },
  }), []);

  const handleTemplateChange = (template: string) => {
    setState(state => ({
      ...state,
      template,
    }));
  };

  const { workspace } = props;
  const { template, isTag } = state;
  const title = isTag ? 'Tag' : 'Variable';
  let editor: JSX.Element | null = null;
  if (isTag) {
    editor = <TagEditor onChange={handleTemplateChange} defaultValue={template} workspace={workspace} editorId={state.editorId} />;
  } else {
    editor = <VariableEditor onChange={handleTemplateChange} defaultValue={template} />;
  }

  return (
    <Modal
      ref={modalRef}
      onHide={() => {
        state.onDone(state.template);
        setState(state => ({
          ...state,
          template: '',
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

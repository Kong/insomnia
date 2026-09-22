import type { Workspace } from 'insomnia-data';
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

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
  onDone: (arg: string) => void;
  editorId?: string;
}

interface NunjucksModalOptions {
  template: string;
  onDone: (arg: string) => void;
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
    onDone: () => {},
    editorId: '',
  });
  const [isRendering, setIsRendering] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
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
    }),
    [],
  );

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
  editor = isTag ? (
    <TagEditor
      onChange={handleTemplateChange}
      defaultValue={template}
      workspace={workspace}
      editorId={state.editorId}
      close={() => modalRef.current?.hide()}
      onRenderingChange={isRendering => setIsRendering(isRendering)}
    />
  ) : (
    <VariableEditor onChange={handleTemplateChange} defaultValue={template} />
  );

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
          className="px-2"
          onSubmit={event => {
            event.preventDefault();
            modalRef.current?.hide();
          }}
        >
          {editor}
        </form>
      </ModalBody>
      <ModalFooter>
        <button className="btn" disabled={isRendering} onClick={() => modalRef.current?.hide()}>
          Done
          {isRendering && <i className="fa fa-spinner fa-spin ml-1.5" />}
        </button>
      </ModalFooter>
    </Modal>
  );
});
NunjucksModal.displayName = 'NunjucksModal';

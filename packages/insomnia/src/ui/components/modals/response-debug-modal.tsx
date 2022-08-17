import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import * as models from '../../../models/index';
import type { Response } from '../../../models/response';
import { ResponseTimelineViewer } from '../../components/viewers/response-timeline-viewer';
import { Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';

interface ResponseDebugModalOptions {
  responseId?: string;
  response?: Response | null;
  showBody?: boolean;
  title?: string | null;
}
export interface ResponseDebugModalHandle {
  show: (options: ResponseDebugModalOptions) => void;
  hide: () => void;
}
export const ResponseDebugModal = forwardRef<ResponseDebugModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<Modal>(null);
  const [state, setState] = useState<ResponseDebugModalOptions>({
    responseId: '',
    response: null,
    showBody: false,
    title: '',
  });
  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: async options => {
      let response = options.response;
      if (!response) {
        response = await models.response.getById(options.responseId || 'n/a');
      }
      setState({
        response,
        title: options.title || null,
        showBody: options.showBody,
      });
      modalRef.current?.show();
    },
  }), []);
  const { response, title, showBody } = state;
  return (
    <Modal ref={modalRef} tall>
      <ModalHeader>{title || 'Response Timeline'}</ModalHeader>
      <ModalBody>
        <div
          style={{
            display: 'grid',
          }}
          className="tall"
        >
          {response ? (
            <ResponseTimelineViewer
              response={response}
              showBody={showBody}
            />
          ) : (
            <div>No response found</div>
          )}
        </div>
      </ModalBody>
    </Modal>
  );
});

ResponseDebugModal.displayName = 'ResponseDebugModal';

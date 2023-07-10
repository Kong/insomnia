import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import { ResponseTimelineEntry } from '../../../main/network/libcurl-promise';
import * as models from '../../../models/index';
import type { Response } from '../../../models/response';
import { ResponseTimelineViewer } from '../../components/viewers/response-timeline-viewer';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';

interface ResponseDebugModalOptions {
  responseId?: string;
  response?: Response | null;
  showBody?: boolean;
  title?: string | null;
}
interface State {
  responseId?: string;
  timeline?: ResponseTimelineEntry[];
  title?: string | null;
}
export interface ResponseDebugModalHandle {
  show: (options: ResponseDebugModalOptions) => void;
  hide: () => void;
}
export const ResponseDebugModal = forwardRef<ResponseDebugModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<State>({
    responseId: '',
    timeline: [],
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
      if (!response) {
        console.error('No response found');
        return;
      }
      const timeline = await models.response.getTimeline(response, options.showBody);
      setState({
        responseId: response._id,
        timeline,
        title: options.title || null,
      });
      modalRef.current?.show();
    },
  }), []);
  const { responseId, timeline, title } = state;
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
          {(responseId && timeline) ? (
            <ResponseTimelineViewer
              key={responseId}
              timeline={timeline}
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

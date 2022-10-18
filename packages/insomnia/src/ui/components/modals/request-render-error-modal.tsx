import { JSONPath } from 'jsonpath-plus';
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import { docsTemplateTags } from '../../../common/documentation';
import { Request } from '../../../models/request';
import { isRequest } from '../../../models/request';
import { RenderError } from '../../../templating';
import { Link } from '../base/link';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { RequestSettingsModal } from '../modals/request-settings-modal';
import { showModal } from './index';
export interface RequestRenderErrorModalOptions {
  error: RenderError | null;
  request: Request | null;
}
export interface RequestRenderErrorModalHandle {
  show: (options: RequestRenderErrorModalOptions) => void;
  hide: () => void;
}

export const RequestRenderErrorModal = forwardRef<RequestRenderErrorModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<RequestRenderErrorModalOptions>({
    error: null,
    request: null,
  });

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: options => {
      setState(options);
      modalRef.current?.show();
    },
  }), []);

  const { request, error } = state;
  const fullPath = `Request.${error?.path}`;
  const result = JSONPath({ json: request, path: `$.${error?.path}` });
  const template = result && result.length ? result[0] : null;
  const locationLabel = template?.includes('\n') ? `line ${error?.location.line} of` : null;
  return (
    <Modal ref={modalRef}>
      <ModalHeader>Failed to Render Request</ModalHeader>
      <ModalBody>{request && error && error ? (
        <div className="pad">
          <div className="notice warning">
            <p>
              Failed to render <strong>{fullPath}</strong> prior to sending
            </p>
            <div className="pad-top-sm">
              {error.path?.match(/^body/) && isRequest(request) && (
                <button
                  className="btn btn--clicky margin-right-sm"
                  onClick={() => {
                    modalRef.current?.hide();
                    showModal(RequestSettingsModal, { request: state.request });
                  }}
                >
                  Adjust Render Settings
                </button>
              )}
              <Link button href={docsTemplateTags} className="btn btn--clicky">
                Templating Documentation <i className="fa fa-external-link" />
              </Link>
            </div>
          </div>

          <p>
            <strong>Render error</strong>
            <code className="block selectable">{error.message}</code>
          </p>

          <p>
            <strong>Caused by the following field</strong>
            <code className="block">
              {locationLabel} {fullPath}
            </code>
          </p>
        </div>
      ) : null}</ModalBody>
    </Modal>
  );
});
RequestRenderErrorModal.displayName = 'RequestRenderErrorModal';

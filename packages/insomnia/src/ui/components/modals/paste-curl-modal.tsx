import React, { useEffect, useRef, useState } from 'react';
import { OverlayContainer } from 'react-aria';

import { CodeEditor } from '~/ui/components/.client/codemirror/code-editor';

import type { Request } from '../../../models/request';
import { Modal, type ModalHandle, type ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';

export const PasteCurlModal = ({
  onHide,
  onImport,
  defaultValue,
}: ModalProps & { onImport: (req: Partial<Request>) => void; defaultValue?: string }) => {
  const modalRef = useRef<ModalHandle>(null);
  const [errorMessage, setError] = useState<string>('');
  const [req, setReq] = useState<any>({});

  useEffect(() => {
    async function parseCurlToRequest() {
      try {
        const { data } = await window.main.parseImport(
          {
            contentStr: defaultValue || '',
          },
          {
            importerId: 'curl',
          },
        );
        const { resources } = data;
        const importedRequest = resources[0];
        setError('');
        setReq(importedRequest);
      } catch (error) {
        console.log('[importer] error', error);
        setError(error.message);
        setReq({});
      } finally {
        modalRef.current?.show();
      }
    }
    parseCurlToRequest();
  }, [defaultValue]);

  return (
    <OverlayContainer onClick={e => e.stopPropagation()}>
      <Modal ref={modalRef} tall onHide={onHide}>
        <ModalHeader>Paste Curl to import request</ModalHeader>
        <ModalBody className="">
          <CodeEditor
            id="paste-curl-content"
            placeholder="Paste curl request here"
            className="border-top"
            mode="text"
            dynamicHeight
            defaultValue={defaultValue}
            onChange={async value => {
              if (!value) {
                setError('Invalid input');
                setReq({});
                return;
              }
              try {
                const { data } = await window.main.parseImport(
                  {
                    contentStr: value,
                  },
                  {
                    importerId: 'curl',
                  },
                );
                const { resources } = data;
                const importedRequest = resources[0];
                setError('');
                setReq(importedRequest);
              } catch (error) {
                console.log('[importer] error', error);
                // Remove error prefix for brevity
                setError(error.message.replace("Error invoking remote method 'parseImport': Error: ", ''));
                setReq({});
              }
            }}
          />
        </ModalBody>
        <ModalFooter>
          <div className="margin-left txt-sm truncate italic">
            {errorMessage ? errorMessage : `Detected ${req.method} request to ${req.url}`}
          </div>
          <div>
            <button className="btn" onClick={() => modalRef.current?.hide()}>
              Cancel
            </button>
            <button
              className="btn"
              onClick={() => {
                onImport(req);
                modalRef.current?.hide();
              }}
              disabled={!errorMessage}
            >
              Import
            </button>
          </div>
        </ModalFooter>
      </Modal>
    </OverlayContainer>
  );
};

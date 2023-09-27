import React, { useEffect, useRef, useState } from 'react';
import { OverlayContainer } from 'react-aria';

import { Request } from '../../../models/request';
import { convert } from '../../../utils/importers/convert';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { CodeEditor } from '../codemirror/code-editor';

export const PasteCurlModal = ({ onHide, onImport, defaultValue }: ModalProps & { onImport: (req: Partial<Request>) => void; defaultValue?: string }) => {
  const modalRef = useRef<ModalHandle>(null);
  const [isValid, setIsValid] = useState<boolean>(true);
  const [req, setReq] = useState<any>({});

  useEffect(() => {
    async function parseCurlToRequest() {
      try {
        const { data } = await convert(defaultValue || '');
        const { resources } = data;
        const importedRequest = resources[0];
        setIsValid(true);
        setReq(importedRequest);

      } catch (error) {
        console.log('error', error);
        setIsValid(false);
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
            className=" border-top"
            mode="text"
            dynamicHeight
            defaultValue={defaultValue}
            onChange={async value => {
              if (!value) {
                return;
              }
              try {
                const { data } = await convert(value);
                const { resources } = data;
                const importedRequest = resources[0];
                setIsValid(true);
                setReq(importedRequest);

              } catch (error) {
                console.log('error', error);
                setIsValid(false);
                setReq({});
              }
            }}
          />
        </ModalBody>
        <ModalFooter>
          <div className="margin-left italic txt-sm truncate">
            {isValid ? `Detected ${req.method} request to ${req.url}` : 'Invalid input'}
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
              disabled={!isValid}
            >
              Import
            </button>
          </div>
        </ModalFooter>
      </Modal>
    </OverlayContainer>
  );
};

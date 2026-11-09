import React, { useEffect, useRef } from 'react';
import { Button } from 'react-aria-components';

import type { KonnectPlugin } from '../../../konnect/api';
import { buildDeckAddCommand, buildDeckEditCommand, type DeckCommandContext } from '../../../konnect/deck';
import { getDeckApplyDocsUrl } from '../../../konnect/links';
import { CopyButton } from '../base/copy-button';
import { Link } from '../base/link';
import { Modal, type ModalHandle, type ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';

type Props = ModalProps &
  (
    | { mode: 'edit'; plugin: KonnectPlugin; pluginName?: never; context: DeckCommandContext }
    | { mode: 'add'; pluginName: string; plugin?: never; context: DeckCommandContext }
  );

export const DeckCommandModal = (props: Props) => {
  const modalRef = useRef<ModalHandle>(null);
  const { mode, context, onHide } = props;
  const command =
    mode === 'edit' ? buildDeckEditCommand(props.plugin, context) : buildDeckAddCommand(props.pluginName, context);

  useEffect(() => {
    modalRef.current?.show();
  }, []);

  return (
    <Modal ref={modalRef} onHide={onHide} wide>
      <ModalHeader>decK command · {mode === 'edit' ? props.plugin.name : props.pluginName}</ModalHeader>
      <ModalBody className="p-4">
        <p className="mb-3 text-sm text-(--hl)">
          {mode === 'edit'
            ? 'This exports the control plane configuration, then applies your edit. Plugin config values are intentionally not shown here.'
            : 'This is a starting point. Fill in the plugin config fields from the plugin docs before applying.'}
        </p>
        <div className="max-h-96 overflow-auto rounded-xs border border-solid border-(--hl-md) bg-(--hl-xs) px-3 py-2">
          <div className="relative flex h-full w-full justify-between gap-(--padding-sm) font-mono text-xs">
            <span className="whitespace-pre-wrap">{command}</span>
            <CopyButton
              size="small"
              content={command}
              title="Copy command"
              aria-label="Copy command"
              confirmMessage=""
              className="sticky top-0 self-start"
            >
              <i className="fa fa-copy" />
            </CopyButton>
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <Link
          href={getDeckApplyDocsUrl()}
          className="text-sm text-(--hl) underline underline-offset-2 hover:text-(--color-font)"
        >
          decK apply docs
        </Link>
        <Button className="btn" onPress={() => modalRef.current?.hide()}>
          Close
        </Button>
      </ModalFooter>
    </Modal>
  );
};

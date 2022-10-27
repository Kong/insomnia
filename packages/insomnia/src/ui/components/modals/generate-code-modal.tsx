import HTTPSnippet, { HTTPSnippetClient, HTTPSnippetTarget } from 'httpsnippet';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';

import { exportHarRequest } from '../../../common/har';
import { Request } from '../../../models/request';
import { CopyButton } from '../base/copy-button';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { Link } from '../base/link';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { CodeEditor, CodeEditorHandle } from '../codemirror/code-editor';

const DEFAULT_TARGET = HTTPSnippet.availableTargets().find(t => t.key === 'shell') as HTTPSnippetTarget;
const DEFAULT_CLIENT = DEFAULT_TARGET?.clients.find(t => t.key === 'curl') as HTTPSnippetClient;
const MODE_MAP: Record<string, string> = {
  c: 'clike',
  java: 'clike',
  csharp: 'clike',
  node: 'javascript',
  objc: 'clike',
  ocaml: 'mllike',
};
const TO_ADD_CONTENT_LENGTH: Record<string, string[]> = {
  node: ['native'],
};

type Props = ModalProps & {
  environmentId: string;
};
export interface GenerateCodeModalOptions {
  request?: Request;
}
export interface State {
  cmd: string;
  request?: Request;
  target: HTTPSnippetTarget;
  client: HTTPSnippetClient;
}
export interface GenerateCodeModalHandle {
  show: (options: GenerateCodeModalOptions) => void;
  hide: () => void;
}
export const GenerateCodeModal = forwardRef<GenerateCodeModalHandle, Props>((props, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const editorRef = useRef<CodeEditorHandle>(null);

  let storedTarget: HTTPSnippetTarget | undefined;
  let storedClient: HTTPSnippetClient | undefined;
  try {
    storedTarget = JSON.parse(window.localStorage.getItem('insomnia::generateCode::target') || '') as HTTPSnippetTarget;
  } catch (error) {}

  try {
    storedClient = JSON.parse(window.localStorage.getItem('insomnia::generateCode::client') || '') as HTTPSnippetClient;
  } catch (error) {}
  const [state, setState] = useState<State>({
    cmd: '',
    request: undefined,
    target: storedTarget || DEFAULT_TARGET,
    client: storedClient || DEFAULT_CLIENT,
  });

  const generateCode = useCallback(async (request: Request, target: HTTPSnippetTarget, client: HTTPSnippetClient) => {
    // Some clients need a content-length for the request to succeed
    const addContentLength = Boolean((TO_ADD_CONTENT_LENGTH[target.key] || []).find(c => c === client.key));
    const har = await exportHarRequest(request._id, props.environmentId, addContentLength);
    // @TODO Should we throw instead?
    if (!har) {
      return;
    }
    const snippet = new HTTPSnippet(har);
    const cmd = snippet.convert(target.key, client.key) || '';
    setState({
      request,
      cmd,
      client,
      target,
    });
    // Save client/target for next time
    window.localStorage.setItem('insomnia::generateCode::client', JSON.stringify(client));
    window.localStorage.setItem('insomnia::generateCode::target', JSON.stringify(target));
  }, [props.environmentId]);

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: options => {
      if (!options.request) {
        return;
      }
      generateCode(options.request, state.target, state.client);
      modalRef.current?.show();
    },
  }), [generateCode, state]);

  const { cmd, target, client, request } = state;
  const targets = HTTPSnippet.availableTargets();
  // NOTE: Just some extra precautions in case the target is messed up
  let clients: HTTPSnippetClient[] = [];
  if (target && Array.isArray(target.clients)) {
    clients = target.clients;
  }
  return (
    <Modal ref={modalRef} tall {...props}>
      <ModalHeader>Generate Client Code</ModalHeader>
      <ModalBody
        noScroll
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gridTemplateRows: 'auto minmax(0, 1fr)',
        }}
      >
        <div className="pad">
          <Dropdown outline>
            <DropdownButton className="btn btn--clicky">
              {target ? target.title : 'n/a'}
              <i className="fa fa-caret-down" />
            </DropdownButton>
            {targets.map(target => (
              <DropdownItem
                key={target.key}
                onClick={() => {
                  const client = target.clients.find(c => c.key === target.default);
                  if (request && client) {
                    generateCode(request, target, client);
                  }
                }}
              >
                {target.title}
              </DropdownItem>
            ))}
          </Dropdown>
            &nbsp;&nbsp;
          <Dropdown outline>
            <DropdownButton className="btn btn--clicky">
              {client ? client.title : 'n/a'}
              <i className="fa fa-caret-down" />
            </DropdownButton>
            {clients.map(client => (
              <DropdownItem
                key={client.key}
                onClick={() => request && generateCode(request, state.target, client)}
              >
                {client.title}
              </DropdownItem>
            ))}
          </Dropdown>
            &nbsp;&nbsp;
          <CopyButton content={cmd} className="pull-right" />
        </div>
        <CodeEditor
          placeholder="Generating code snippet..."
          className="border-top"
          key={Date.now()}
          mode={MODE_MAP[target.key] || target.key}
          ref={editorRef}
          defaultValue={cmd}
        />
      </ModalBody>
      <ModalFooter>
        <div className="margin-left italic txt-sm">
          * Code snippets generated by&nbsp;
          <Link href="https://github.com/Kong/httpsnippet">httpsnippet</Link>
        </div>
        <button className="btn" onClick={() => modalRef.current?.hide()}>
          Done
        </button>
      </ModalFooter>
    </Modal>
  );
});
GenerateCodeModal.displayName = 'GenerateCodeModal';

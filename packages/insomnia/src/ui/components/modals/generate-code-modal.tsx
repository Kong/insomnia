import type { HTTPSnippetClient, HTTPSnippetTarget } from 'httpsnippet';
import React, { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';

import { exportHarRequest } from '../../../common/har';
import { Request } from '../../../models/request';
import { CopyButton } from '../base/copy-button';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';
import { Link } from '../base/link';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { CodeEditor, CodeEditorHandle } from '../codemirror/code-editor';

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
  request?: Request;
  target?: HTTPSnippetTarget;
  client?: HTTPSnippetClient;
  targets: HTTPSnippetTarget[];
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
  } catch (error) { }

  try {
    storedClient = JSON.parse(window.localStorage.getItem('insomnia::generateCode::client') || '') as HTTPSnippetClient;
  } catch (error) { }
  const [state, setState] = useState<State>({
    request: undefined,
    target: storedTarget,
    client: storedClient,
    targets: [],
  });

  const [snippet, setSnippet] = useState<string>('');

  const generateCode = useCallback(async (request: Request, target?: HTTPSnippetTarget, client?: HTTPSnippetClient) => {
    const HTTPSnippet = (await import('httpsnippet')).default;

    const targets = HTTPSnippet.availableTargets();
    const targetOrFallback = target || targets.find(t => t.key === 'shell') as HTTPSnippetTarget;
    const clientOrFallback = client || targetOrFallback.clients.find(t => t.key === 'curl') as HTTPSnippetClient;

    setState({
      request,
      client: clientOrFallback,
      target: targetOrFallback,
      targets,
    });
    // Save client/target for next time
    window.localStorage.setItem('insomnia::generateCode::client', JSON.stringify(clientOrFallback));
    window.localStorage.setItem('insomnia::generateCode::target', JSON.stringify(targetOrFallback));

    // Some clients need a content-length for the request to succeed
    const addContentLength = Boolean((TO_ADD_CONTENT_LENGTH[targetOrFallback.key] || []).find(c => c === clientOrFallback.key));
    const har = await exportHarRequest(request._id, props.environmentId, addContentLength);
    if (har) {
      const snippet = new HTTPSnippet(har);
      const cmd = snippet.convert(targetOrFallback.key, clientOrFallback.key) || '';
      setSnippet(cmd);
    }
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

  const { target, targets, client, request } = state;
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
          <Dropdown
            aria-label='Select a target'
            triggerButton={
              <DropdownButton className="btn btn--clicky">
                {target ? target.title : 'n/a'}
                <i className="fa fa-caret-down" />
              </DropdownButton>
            }
          >
            {targets.map(target => (
              <DropdownItem
                key={target.key}
                aria-label={target.title}
              >
                <ItemContent
                  label={target.title}
                  onClick={() => {
                    const client = target.clients.find(c => c.key === target.default);
                    if (request && client) {
                      generateCode(request, target, client);
                    }
                  }}
                />
              </DropdownItem>
            ))}
          </Dropdown>
          &nbsp;&nbsp;
          <Dropdown
            aria-label='Select a client'
            triggerButton={
              <DropdownButton className="btn btn--clicky">
                {client ? client.title : 'n/a'}
                <i className="fa fa-caret-down" />
              </DropdownButton>
            }
          >
            {clients.map(client => (
              <DropdownItem
                key={client.key}
                aria-label={client.title}
              >
                <ItemContent
                  label={client.title}
                  onClick={() => request && generateCode(request, state.target, client)}
                />
              </DropdownItem>
            ))}
          </Dropdown>
          &nbsp;&nbsp;
          <CopyButton content={snippet} className="pull-right" />
        </div>
        {target && <CodeEditor
          id="generate-code-modal-content"
          placeholder="Generating code snippet..."
          className="border-top"
          key={Date.now()}
          mode={MODE_MAP[target.key] || target.key}
          ref={editorRef}
          defaultValue={snippet}
        />}
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

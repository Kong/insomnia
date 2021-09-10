import { autoBindMethodsForReact } from 'class-autobind-decorator';
import HTTPSnippet, { HTTPSnippetClient, HTTPSnippetTarget } from 'httpsnippet';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { exportHarRequest } from '../../../common/har';
import { Request } from '../../../models/request';
import { CopyButton } from '../base/copy-button';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import Link from '../base/link';
import Modal from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import CodeEditor, { UnconnectedCodeEditor } from '../codemirror/code-editor';

const DEFAULT_TARGET = HTTPSnippet.availableTargets().find(t => t.key === 'shell') as HTTPSnippetTarget;
const DEFAULT_CLIENT = DEFAULT_TARGET?.clients.find(t => t.key === 'curl') as HTTPSnippetClient;
const MODE_MAP = {
  c: 'clike',
  java: 'clike',
  csharp: 'clike',
  node: 'javascript',
  objc: 'clike',
  ocaml: 'mllike',
};
const TO_ADD_CONTENT_LENGTH = {
  node: ['native'],
};

interface Props {
  environmentId: string;
  editorFontSize: number;
  editorIndentSize: number;
  editorKeyMap: string;
}

interface State {
  cmd: string;
  request?: Request;
  target: HTTPSnippetTarget;
  client: HTTPSnippetClient;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class GenerateCodeModal extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    let target: HTTPSnippetTarget | undefined;
    let client: HTTPSnippetClient | undefined;

    // Load preferences from localStorage
    try {
      target = JSON.parse(window.localStorage.getItem('insomnia::generateCode::target') || '') as HTTPSnippetTarget;
    } catch (e) {}

    try {
      client = JSON.parse(window.localStorage.getItem('insomnia::generateCode::client') || '') as HTTPSnippetClient;
    } catch (e) {}

    this.state = {
      cmd: '',
      request: undefined,
      target: target || DEFAULT_TARGET,
      client: client || DEFAULT_CLIENT,
    };
  }

  modal: Modal | null = null;
  _editor: UnconnectedCodeEditor | null = null;

  _setModalRef(n: Modal) {
    this.modal = n;
  }

  _setEditorRef(n: UnconnectedCodeEditor) {
    this._editor = n;
  }

  hide() {
    this.modal?.hide();
  }

  _handleClientChange(client) {
    const { target, request } = this.state;

    if (!request) {
      return;
    }
    this._generateCode(request, target, client);
  }

  _handleTargetChange(target) {
    const { target: currentTarget, request } = this.state;

    if (currentTarget.key === target.key) {
      // No change
      return;
    }

    const client = target.clients.find(c => c.key === target.default);

    if (!request) {
      return;
    }
    this._generateCode(request, target, client);
  }

  async _generateCode(request: Request, target: HTTPSnippetTarget, client: HTTPSnippetClient) {
    // Some clients need a content-length for the request to succeed
    const addContentLength = (TO_ADD_CONTENT_LENGTH[target.key] || []).find(c => c === client.key);
    const { environmentId } = this.props;
    const har = await exportHarRequest(request._id, environmentId, addContentLength);
    // @TODO Should we throw instead?
    if (!har) return;
    const snippet = new HTTPSnippet(har);
    const cmd = snippet.convert(target.key, client.key) || '';
    this.setState({
      request,
      cmd,
      client,
      target,
    });
    // Save client/target for next time
    window.localStorage.setItem('insomnia::generateCode::client', JSON.stringify(client));
    window.localStorage.setItem('insomnia::generateCode::target', JSON.stringify(target));
  }

  show(request: Request) {
    const { client, target } = this.state;

    this._generateCode(request, target, client);

    this.modal?.show();
  }

  render() {
    const { cmd, target, client } = this.state;
    const { editorFontSize, editorIndentSize, editorKeyMap } = this.props;
    const targets = HTTPSnippet.availableTargets();
    // NOTE: Just some extra precautions in case the target is messed up
    let clients: HTTPSnippetClient[] = [];

    if (target && Array.isArray(target.clients)) {
      clients = target.clients;
    }

    return (
      <Modal ref={this._setModalRef} tall {...this.props}>
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
                {
                  target ? target.title : 'n/a'
                }
                <i className="fa fa-caret-down" />
              </DropdownButton>
              {targets.map(target => (
                <DropdownItem key={target.key} onClick={this._handleTargetChange} value={target}>
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
                  onClick={this._handleClientChange}
                  value={client}
                >
                  {client.title}
                </DropdownItem>
              ))}
            </Dropdown>
            &nbsp;&nbsp;
            <CopyButton content={cmd} className="pull-right" />
          </div>
          <CodeEditor
            lineWrapping
            placeholder="Generating code snippet..."
            className="border-top"
            key={Date.now()}
            mode={MODE_MAP[target.key] || target.key}
            ref={this._setEditorRef}
            fontSize={editorFontSize}
            indentSize={editorIndentSize}
            keyMap={editorKeyMap}
            defaultValue={cmd}
          />
        </ModalBody>
        <ModalFooter>
          <div className="margin-left italic txt-sm">
            * Code snippets generated by&nbsp;
            <Link href="https://github.com/Kong/httpsnippet">httpsnippet</Link>
          </div>
          <button className="btn" onClick={this.hide}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

export default GenerateCodeModal;

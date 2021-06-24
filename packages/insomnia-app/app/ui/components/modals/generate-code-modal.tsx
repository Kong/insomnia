import React, { PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import HTTPSnippet, { availableTargets } from 'httpsnippet';
import CopyButton from '../base/copy-button';
import { Dropdown, DropdownButton, DropdownItem } from '../base/dropdown';
import CodeEditor from '../codemirror/code-editor';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import { exportHarRequest } from '../../../common/har';
import Link from '../base/link';

const DEFAULT_TARGET = availableTargets().find(t => t.key === 'shell');
const DEFAULT_CLIENT = DEFAULT_TARGET.clients.find(t => t.key === 'curl');
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
  request: null;
  target: string;
  client: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class GenerateCodeModal extends PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    let client;
    let target;

    // Load preferences from localStorage
    try {
      // @ts-expect-error -- TSCONVERSION
      target = JSON.parse(window.localStorage.getItem('insomnia::generateCode::target'));
    } catch (e) {}

    try {
      // @ts-expect-error -- TSCONVERSION
      client = JSON.parse(window.localStorage.getItem('insomnia::generateCode::client'));
    } catch (e) {}

    this.state = {
      cmd: '',
      request: null,
      target: target || DEFAULT_TARGET,
      client: client || DEFAULT_CLIENT,
    };
  }

  modal: Modal | null = null;
  _editor: CodeEditor | null = null;

  _setModalRef(n: Modal) {
    this.modal = n;
  }

  _setEditorRef(n: CodeEditor) {
    this._editor = n;
  }

  hide() {
    this.modal?.hide();
  }

  _handleClientChange(client) {
    const { target, request } = this.state;

    this._generateCode(request, target, client);
  }

  _handleTargetChange(target) {
    const { target: currentTarget } = this.state;

    // @ts-expect-error -- TSCONVERSION
    if (currentTarget.key === target.key) {
      // No change
      return;
    }

    const client = target.clients.find(c => c.key === target.default);

    this._generateCode(this.state.request, target, client);
  }

  async _generateCode(request, target, client) {
    // Some clients need a content-length for the request to succeed
    const addContentLength = (TO_ADD_CONTENT_LENGTH[target.key] || []).find(c => c === client.key);
    const { environmentId } = this.props;
    const har = await exportHarRequest(request._id, environmentId, addContentLength);
    const snippet = new HTTPSnippet(har);
    const cmd = snippet.convert(target.key, client.key);
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

  show(request) {
    const { client, target } = this.state;

    this._generateCode(request, target, client);

    this.modal?.show();
  }

  render() {
    const { cmd, target, client } = this.state;
    const { editorFontSize, editorIndentSize, editorKeyMap } = this.props;
    const targets = availableTargets();
    // NOTE: Just some extra precautions in case the target is messed up
    let clients = [];

    // @ts-expect-error -- TSCONVERSION
    if (target && Array.isArray(target.clients)) {
      // @ts-expect-error -- TSCONVERSION
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
          }}>
          <div className="pad">
            <Dropdown outline>
              <DropdownButton className="btn btn--clicky">
                {
                  // @ts-expect-error -- TSCONVERSION
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
                {

                  // @ts-expect-error -- TSCONVERSION
                  client ? client.title : 'n/a'
                }
                <i className="fa fa-caret-down" />
              </DropdownButton>
              {clients.map(client => (
                <DropdownItem
                  // @ts-expect-error -- TSCONVERSION
                  key={client.key}
                  onClick={this._handleClientChange}
                  value={client}
                >
                  {
                    // @ts-expect-error -- TSCONVERSION
                    client.title
                  }
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
            // @ts-expect-error -- TSCONVERSION
            mode={MODE_MAP[target.key] || target.key}
            ref={this._setEditorRef}
            fontSize={editorFontSize}
            indentSize={editorIndentSize}
            keyMap={editorKeyMap}
            defaultValue={cmd}
          />
        </ModalBody>
        <ModalFooter>
          <div className="margin-left italic txt-sm tall">
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

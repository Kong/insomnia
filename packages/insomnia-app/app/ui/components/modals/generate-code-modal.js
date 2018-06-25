import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import HTTPSnippet, { availableTargets } from 'insomnia-httpsnippet';
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
  ocaml: 'mllike'
};

const TO_ADD_CONTENT_LENGTH = {
  node: ['native']
};

@autobind
class GenerateCodeModal extends PureComponent {
  constructor(props) {
    super(props);

    let client;
    let target;

    // Load preferences from localStorage

    try {
      target = JSON.parse(
        window.localStorage.getItem('insomnia::generateCode::target')
      );
    } catch (e) {}
    try {
      client = JSON.parse(
        window.localStorage.getItem('insomnia::generateCode::client')
      );
    } catch (e) {}

    this.state = {
      cmd: '',
      request: null,
      target: target || DEFAULT_TARGET,
      client: client || DEFAULT_CLIENT
    };
  }

  _setModalRef(n) {
    this.modal = n;
  }
  _setEditorRef(n) {
    this._editor = n;
  }

  hide() {
    this.modal.hide();
  }

  _handleClientChange(client) {
    const { target, request } = this.state;
    this._generateCode(request, target, client);
  }

  _handleTargetChange(target) {
    const { target: currentTarget } = this.state;
    if (currentTarget.key === target.key) {
      // No change
      return;
    }

    const client = target.clients.find(c => c.key === target.default);
    this._generateCode(this.state.request, target, client);
  }

  async _generateCode(request, target, client) {
    // Some clients need a content-length for the request to succeed
    const addContentLength = (TO_ADD_CONTENT_LENGTH[target.key] || []).find(
      c => c === client.key
    );

    const { environmentId } = this.props;
    const har = await exportHarRequest(
      request._id,
      environmentId,
      addContentLength
    );
    const snippet = new HTTPSnippet(har);
    const cmd = snippet.convert(target.key, client.key);

    this.setState({ request, cmd, client, target });

    // Save client/target for next time
    window.localStorage.setItem(
      'insomnia::generateCode::client',
      JSON.stringify(client)
    );
    window.localStorage.setItem(
      'insomnia::generateCode::target',
      JSON.stringify(target)
    );
  }

  show(request) {
    const { client, target } = this.state;
    this._generateCode(request, target, client);
    this.modal.show();
  }

  render() {
    const { cmd, target, client } = this.state;
    const { editorFontSize, editorIndentSize, editorKeyMap } = this.props;

    const targets = availableTargets();

    // NOTE: Just some extra precautions in case the target is messed up
    let clients = [];
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
            gridTemplateRows: 'auto minmax(0, 1fr)'
          }}>
          <div className="pad">
            <Dropdown outline>
              <DropdownButton className="btn btn--clicky">
                {target ? target.title : 'n/a'}
                <i className="fa fa-caret-down" />
              </DropdownButton>
              {targets.map(target => (
                <DropdownItem
                  key={target.key}
                  onClick={this._handleTargetChange}
                  value={target}>
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
                  value={client}>
                  {client.title}
                </DropdownItem>
              ))}
            </Dropdown>
            &nbsp;&nbsp;
            <CopyButton content={cmd} className="pull-right btn btn--clicky" />
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
          <div className="margin-left italic txt-sm tall">
            * Code snippets generated by&nbsp;
            <Link href="https://github.com/Mashape/httpsnippet">
              httpsnippet
            </Link>
          </div>
          <button className="btn" onClick={this.hide}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

GenerateCodeModal.propTypes = {
  environmentId: PropTypes.string.isRequired,
  editorFontSize: PropTypes.number.isRequired,
  editorIndentSize: PropTypes.number.isRequired,
  editorKeyMap: PropTypes.string.isRequired
};

export default GenerateCodeModal;

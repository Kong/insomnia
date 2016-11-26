import React, {Component, PropTypes} from 'react';
import HTTPSnippet, {availableTargets} from 'httpsnippet';

import CopyButton from '../base/CopyButton';
import {Dropdown, DropdownButton, DropdownItem} from '../base/dropdown';
import Editor from '../base/Editor';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import {exportHar} from '../../../common/har';
import {trackEvent} from '../../../analytics/index';

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


class GenerateCodeModal extends Component {
  constructor (props) {
    super(props);

    let client;
    let target;

    // Load preferences from localStorage

    try {
      target = JSON.parse(localStorage.getItem('insomnia::generateCode::target'));
    } catch (e) {
    }
    try {
      client = JSON.parse(localStorage.getItem('insomnia::generateCode::client'));
    } catch (e) {
    }

    this.state = {
      cmd: '',
      request: null,
      target: target || DEFAULT_TARGET,
      client: client || DEFAULT_CLIENT,
    };
  }

  _handleClientChange (client) {
    const {target, request} = this.state;
    this._generateCode(request, target, client);
    trackEvent('Generate Code', 'Client Change', `${target.title}/${client.title}`);
  }

  _handleTargetChange (target) {
    const {target: currentTarget} = this.state;
    if (currentTarget.key === target.key) {
      // No change
      return;
    }

    const client = target.clients.find(c => c.key === target.default);
    this._generateCode(this.state.request, target, client);
    trackEvent('Generate Code', 'Target Change', target.title);
  }

  async _generateCode (request, target, client) {
    // Some clients need a content-length for the request to succeed
    const addContentLength = (TO_ADD_CONTENT_LENGTH[target.key] || []).find(c => c === client.key);

    const {environmentId} = this.props;
    const har = await exportHar(request._id, environmentId, addContentLength);
    const snippet = new HTTPSnippet(har);
    const cmd = snippet.convert(target.key, client.key);

    this.setState({request, cmd, client, target});

    // Save client/target for next time
    localStorage.setItem('insomnia::generateCode::client', JSON.stringify(client));
    localStorage.setItem('insomnia::generateCode::target', JSON.stringify(target));
  }

  show (request) {
    const {client, target} = this.state;
    this._generateCode(request, target, client);
    this.modal.show();
  }

  render () {
    const {cmd, target, client} = this.state;

    const targets = availableTargets();

    // NOTE: Just some extra precautions in case the target is messed up
    let clients = [];
    if (target && Array.isArray(target.clients)) {
      clients = target.clients;
    }

    return (
      <Modal ref={m => this.modal = m} tall={true} {...this.props}>
        <ModalHeader>Generate Client Code</ModalHeader>
        <ModalBody noScroll={true} style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gridTemplateRows: 'auto minmax(0, 1fr)'
        }}>
          <div className="pad">
            <Dropdown outline={true}>
              <DropdownButton className="btn btn--clicky">
                {target ? target.title : 'n/a'}
                <i className="fa fa-caret-down"></i>
              </DropdownButton>
              {targets.map(target => (
                <DropdownItem key={target.key} onClick={() => this._handleTargetChange(target)}>
                  {target.title}
                </DropdownItem>
              ))}
            </Dropdown>
            &nbsp;&nbsp;
            <Dropdown outline={true}>
              <DropdownButton className="btn btn--clicky">
                {client ? client.title : 'n/a'}
                <i className="fa fa-caret-down"></i>
              </DropdownButton>
              {clients.map(client => (
                <DropdownItem key={client.key} onClick={() => this._handleClientChange(client)}>
                  {client.title}
                </DropdownItem>
              ))}
            </Dropdown>
            &nbsp;&nbsp;
            <CopyButton content={cmd}
                        className="pull-right btn btn--clicky"/>
          </div>
          <Editor
            className="border-top"
            key={Date.now()}
            mode={MODE_MAP[target.key] || target.key}
            ref={n => this._editor = n}
            lightTheme={true}
            lineWrapping={true}
            value={cmd}
          />
        </ModalBody>
        <ModalFooter>
          <div className="margin-left faint italic txt-sm tall">
            * copy/paste this command into a Unix terminal
          </div>
          <button className="btn" onClick={e => this.modal.hide()}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

GenerateCodeModal.propTypes = {
  environmentId: PropTypes.string.isRequired,
};

export default GenerateCodeModal;

import React, {PropTypes, Component} from 'react';

import Link from '../base/Link';
import EnvironmentEditor from '../editors/EnvironmentEditor';
import Dropdown from '../base/Dropdown';
import DropdownDivider from '../base/DropdownDivider';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as db from '../../database'


class WorkspaceEnvironmentsEditModal extends Component {
  constructor (props) {
    super(props);

    this.state = {
      workspace: null,
      isValid: true
    }
  }

  show (workspace) {
    this.modal.show();
    this.setState({workspace});
  }

  toggle (workspace) {
    this.modal.toggle();
    this.setState({workspace});
  }

  _didChange () {
    const isValid = this._envEditor.isValid();
    if (this.state.isValid !== isValid) {
      this.setState({isValid});
    }
  }

  _saveChanges () {
    const {workspace} = this.state;
    const environment = this._envEditor.getValue();
    db.workspaceUpdate(workspace, {environment});
    this.modal.hide();
  }

  render () {
    const {workspace, isValid} = this.state;
    const environment = workspace ? workspace.environment : {};

    return (
      <Modal ref={m => this.modal = m} top={true} tall={true} {...this.props}>
        <ModalHeader>
          Environments
        </ModalHeader>
        <ModalBody className="environments-editor">
          <div className="pad no-pad-bottom">
            <label className="label--small">Select Environment</label>
            <br/>
            <Dropdown outline={true}>
              <button className="btn btn--super-compact btn--outlined">
                Base Environment <i className="fa fa-caret-down"></i>
              </button>
              <ul>
                <DropdownDivider name="Global"></DropdownDivider>
                <li>
                  <button>
                    <i className="fa fa-home"></i> Base Environment
                  </button>
                </li>
                <DropdownDivider name="Sub Environments"></DropdownDivider>
                <li>
                  <button><i className="fa fa-empty"></i> Coming soon...</button>
                </li>
              </ul>
            </Dropdown>
            <button className="pull-right btn btn--super-compact btn--outlined">
              <i className="fa fa-trash-o"></i>
            </button>
            <hr/>
          </div>
          <EnvironmentEditor
            ref={n => this._envEditor = n}
            key={workspace ? workspace._id : 'n/a'}
            environment={environment || {}}
            didChange={this._didChange.bind(this)}
            lightTheme={true}
          />
        </ModalBody>
        <ModalFooter>
          <div className="pull-right">
            <button className="btn" onClick={e => this.modal.hide()}>Cancel</button>
            <button className="btn" onClick={e => this._saveChanges()} disabled={!isValid}>
              Save
            </button>
          </div>
          <div className="pad faint italic txt-sm tall">
            * this data can be used for&nbsp;
            <Link href="https://mozilla.github.io/nunjucks/templating.html">
              Nunjucks Templating
            </Link> in your requests
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

WorkspaceEnvironmentsEditModal.propTypes = {
  onChange: PropTypes.func.isRequired
};

export default WorkspaceEnvironmentsEditModal;

export let show = null;

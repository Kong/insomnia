import React, {PropTypes} from 'react';

import Link from '../base/Link';
import EnvironmentEditor from '../EnvironmentEditor';
import Dropdown from '../base/Dropdown';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import ModalComponent from '../lib/ModalComponent';


class WorkspaceEnvironmentsEditModal extends ModalComponent {
  constructor (props) {
    super(props);

    this.state = {
      workspace: null
    }
  }

  show (workspace) {
    super.show();
    this.setState({workspace});
  }

  toggle (workspace) {
    super.toggle();
    this.setState({workspace});
  }

  _didChange () {

  }

  _saveChanges () {

  }

  render () {
    const {workspace} = this.state;
    const environment = workspace ? workspace.environments[0] || {} : {};

    return (
      <Modal ref="modal" top={true} tall={true} {...this.props}>
        <ModalHeader>
          Environments <span className="faint txt-sm">– share variables across requests</span>
        </ModalHeader>
        <ModalBody>
          <div className="pad no-pad-bottom">
            <Dropdown outline={true}>
              <button className="btn btn--super-compact btn--outlined">
                Production <i className="fa fa-caret-down"></i>
              </button>
              <ul>
                <li>
                  <button>Production</button>
                </li>
                <li>
                  <button>Staging</button>
                </li>
                <li>
                  <button>Development</button>
                </li>
              </ul>
            </Dropdown>
            <hr/>
          </div>
          <EnvironmentEditor
            ref={node => this._envEditor = node}
            key={workspace ? workspace._id : 'n/a'}
            environment={environment || {}}
            didChange={this._didChange.bind(this)}
            lightTheme={true}
          />
        </ModalBody>
        <ModalFooter>
          <div className="pull-right">
            <button className="btn" onClick={this._saveChanges.bind(this)}>Save</button>
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

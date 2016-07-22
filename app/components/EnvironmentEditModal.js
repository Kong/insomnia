import React, {PropTypes} from 'react';

import Link from './base/Link';
import Editor from './base/Editor';
import Modal from './base/Modal';
import ModalBody from './base/ModalBody';
import ModalHeader from './base/ModalHeader';
import ModalFooter from './base/ModalFooter';
import ModalComponent from './lib/ModalComponent';


class EnvironmentEditModal extends ModalComponent {
  constructor (props) {
    super(props);

    this.state = {
      environmentJSON: '{}',
      requestGroup: null
    }
  }

  _saveChanges () {
    const {requestGroup, environmentJSON} = this.state;

    let environment;
    try {
      environment = JSON.parse(environmentJSON);
    } catch (e) {
      // That's OK. The user will (hopefully) fix the problem
      console.warn('Failed to parse environment JSON', e);
      return;
    }

    this.props.onChange(Object.assign({}, requestGroup, {environment}));
    this.hide();
  }

  _handleChange (environmentJSON) {
    this.setState({environmentJSON});
  }

  _update (requestGroup) {
    const environmentJSON = JSON.stringify(requestGroup.environment, null, '\t');
    this.setState({environmentJSON, requestGroup});
  }

  show (requestGroup) {
    super.show();
    this._update(requestGroup);
  }

  toggle (requestGroup) {
    super.toggle();
    this._update(requestGroup);
  }

  render () {
    const {environmentJSON} = this.state;

    return (
      <Modal ref="modal" top={true} {...this.props}>
        <ModalHeader>Environment Variables</ModalHeader>
        <ModalBody>
          <div className="pad-bottom">
            <Editor
              onChange={this._handleChange.bind(this)}
              value={environmentJSON}
              lightTheme={true}
              mode="application/json"
            />
          </div>
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

EnvironmentEditModal.propTypes = {
  onChange: PropTypes.func.isRequired
};

export default EnvironmentEditModal;

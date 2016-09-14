import React, {PropTypes, Component} from 'react';
import classnames from 'classnames';

import Link from '../base/Link';
import EnvironmentEditor from '../editors/EnvironmentEditor';
import Editable from '../base/Editable';
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
      isValid: true,
      subEnvironments: [],
      rootEnvironment: null,
      activeEnvironmentId: null
    }
  }

  show (workspace) {
    this.modal.show();
    this._load(workspace);
  }

  toggle (workspace) {
    this.modal.toggle();
    this._load(workspace);
  }

  _load (workspace, environmentToActivate = null) {
    db.environmentGetOrCreateForWorkspace(workspace).then(rootEnvironment => {
      db.environmentFindByParentId(rootEnvironment._id).then(subEnvironments => {
        let activeEnvironmentId;
        if (environmentToActivate) {
          activeEnvironmentId = environmentToActivate._id
        } else {
          activeEnvironmentId = this.state.activeEnvironmentId || rootEnvironment._id;
        }

        this.setState({workspace, rootEnvironment, subEnvironments, activeEnvironmentId});
      });
    });
  }

  _handleAddEnvironment () {
    const {rootEnvironment, workspace} = this.state;
    db.environmentCreate({parentId: rootEnvironment._id}).then(environment => {
      this._load(workspace, environment);
    });
  }

  _handleActivateEnvironment (environment) {
    // Don't allow switching if the current one has errors
    if (!this._envEditor.isValid()) {
      return;
    }

    const {workspace} = this.state;
    this._load(workspace, environment);
  }

  _handleDeleteEnvironment (environment) {
    const {rootEnvironment, workspace} = this.state;

    // Don't delete the root environment
    if (environment === rootEnvironment) {
      return;
    }

    // Delete the current one, then activate the root environment
    db.environmentRemove(environment).then(() => {
      this._load(workspace, rootEnvironment);
    });
  }

  _handleChangeEnvironmentName (environment, name) {
    const {workspace} = this.state;
    db.environmentUpdate(environment, {name}).then(() => {
      this._load(workspace);
    });
  }

  _didChange () {
    const isValid = this._envEditor.isValid();

    if (this.state.isValid === isValid) {
      this.setState({isValid});
    }

    this._saveChanges();
  }

  _getActiveEnvironment () {
    const {activeEnvironmentId, subEnvironments, rootEnvironment} = this.state;

    if (rootEnvironment && rootEnvironment._id === activeEnvironmentId) {
      return rootEnvironment;
    } else {
      return subEnvironments.find(e => e._id === activeEnvironmentId);
    }
  }

  _saveChanges () {
    // Only save if it's valid
    if (!this._envEditor.isValid()) {
      return;
    }

    const environment = this._envEditor.getValue();
    const activeEnvironment = this._getActiveEnvironment();

    db.environmentUpdate(activeEnvironment, {data: environment});
  }

  render () {
    const {subEnvironments, rootEnvironment, isValid} = this.state;
    const activeEnvironment = this._getActiveEnvironment();

    return (
      <Modal ref={m => this.modal = m} wide={true} top={true} tall={true} {...this.props}>
        <ModalHeader>Manage Environments (JSON Format)</ModalHeader>
        <ModalBody noScroll={true} className="env-modal">
          <div className="env-modal__sidebar">
            <li onClick={() => this._handleActivateEnvironment(rootEnvironment)}
                className={classnames(
                  'env-modal__sidebar-root-item',
                  {'env-modal__sidebar-item--active': activeEnvironment === rootEnvironment}
                )}>
              <button>{rootEnvironment ? rootEnvironment.name : ''}</button>
            </li>
            <div className="pad env-modal__sidebar-heading">
              <h3>Sub Environments</h3>
              <button onClick={() => this._handleAddEnvironment()}>
                <i className="fa fa-plus-circle"></i>
              </button>
            </div>
            <ul>
              {subEnvironments.map(environment => {
                const classes = classnames(
                  'env-modal__sidebar-item',
                  {'env-modal__sidebar-item--active': activeEnvironment === environment}
                );

                return (
                  <li key={environment._id} className={classes}>
                    <button onClick={() => this._handleActivateEnvironment(environment)}>
                      <Editable
                        onSubmit={name => this._handleChangeEnvironmentName(environment, name)}
                        value={environment.name}
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
          <div className="env-modal__main">
            <div className="env-modal__main__header">
              <h1>
                <Editable
                  singleClick={true}
                  onSubmit={name => this._handleChangeEnvironmentName(activeEnvironment, name)}
                  value={activeEnvironment ? activeEnvironment.name : ''}
                />
              </h1>
              {rootEnvironment !== activeEnvironment ? (
                <button className="btn btn--super-compact btn--outlined"
                        onClick={() => this._handleDeleteEnvironment(activeEnvironment)}>
                  <i className="fa fa-trash-o"></i>
                </button>
              ) : null}
            </div>
            <div className="env-modal__editor">
              <EnvironmentEditor
                ref={n => this._envEditor = n}
                key={activeEnvironment ? activeEnvironment._id : 'n/a'}
                environment={activeEnvironment ? activeEnvironment.data : {}}
                didChange={this._didChange.bind(this)}
                lightTheme={true}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="pull-right">
            <button className="btn" disabled={!isValid} onClick={e => this.modal.hide()}>
              Done
            </button>
          </div>
          <div className="pad faint italic txt-sm tall">
            * environment data can be used for&nbsp;
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

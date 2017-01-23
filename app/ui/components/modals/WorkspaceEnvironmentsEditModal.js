import React, {PropTypes, Component} from 'react';
import classnames from 'classnames';

import PromptButton from '../base/PromptButton';
import Link from '../base/Link';
import EnvironmentEditor from '../editors/EnvironmentEditor';
import Editable from '../base/Editable';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import * as models from '../../../models'
import {trackEvent} from '../../../analytics/index';


class WorkspaceEnvironmentsEditModal extends Component {
  state = {
    workspace: null,
    isValid: true,
    subEnvironments: [],
    rootEnvironment: null,
    activeEnvironmentId: null,
    forceRefreshKey: 0,
  };

  show (workspace) {
    this.modal.show();
    this._load(workspace);
    trackEvent('Environment Editor', 'Show');
  }

  toggle (workspace) {
    this.modal.toggle();
    this._load(workspace);
  }

  async _load (workspace, environmentToActivate = null) {
    const rootEnvironment = await models.environment.getOrCreateForWorkspace(workspace);
    const subEnvironments = await models.environment.findByParentId(rootEnvironment._id);

    let activeEnvironmentId;

    if (environmentToActivate) {
      activeEnvironmentId = environmentToActivate._id
    } else if (this.state.workspace && workspace._id !== this.state.workspace._id) {
      // We've changed workspaces, so load the root one
      activeEnvironmentId = rootEnvironment._id;
    } else {
      // We haven't changed workspaces, so try loading the last environment, and fall back
      // to the root one
      activeEnvironmentId = this.state.activeEnvironmentId || rootEnvironment._id;
    }

    this.setState({
      workspace,
      rootEnvironment,
      subEnvironments,
      activeEnvironmentId,
      forceRefreshKey: Date.now(),
    });
  }

  async _handleAddEnvironment () {
    const {rootEnvironment, workspace} = this.state;
    const parentId = rootEnvironment._id;
    const environment = await models.environment.create({parentId});
    this._load(workspace, environment);
    trackEvent('Environment', 'Create');
  }

  _handleShowEnvironment (environment) {
    // Don't allow switching if the current one has errors
    if (!this._envEditor.isValid()) {
      return;
    }

    const {workspace} = this.state;
    this._load(workspace, environment);
    trackEvent('Environment Editor', 'Show Environment');
  }

  async _handleDeleteEnvironment (environment) {
    const {rootEnvironment, workspace} = this.state;

    // Don't delete the root environment
    if (environment === rootEnvironment) {
      return;
    }

    // Delete the current one, then activate the root environment
    await models.environment.remove(environment);

    this._load(workspace, rootEnvironment);
    trackEvent('Environment', 'Delete');
  }

  async _handleChangeEnvironmentName (environment, name) {
    const {workspace} = this.state;

    // NOTE: Fetch the environment first because it might not be up to date.
    // For example, editing the body updates silently.
    const realEnvironment = await models.environment.getById(environment._id);
    await models.environment.update(realEnvironment, {name});
    this._load(workspace);

    trackEvent('Environment', 'Rename');
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

    const data = this._envEditor.getValue();
    const activeEnvironment = this._getActiveEnvironment();

    models.environment.update(activeEnvironment, {data});
  }

  render () {
    const {editorFontSize} = this.props;
    const {subEnvironments, rootEnvironment, isValid, forceRefreshKey} = this.state;
    const activeEnvironment = this._getActiveEnvironment();

    return (
      <Modal ref={m => this.modal = m} wide={true} top={true} tall={true} {...this.props}>
        <ModalHeader>Manage Environments</ModalHeader>
        <ModalBody noScroll={true} className="env-modal">
          <div className="env-modal__sidebar">
            <li onClick={() => this._handleShowEnvironment(rootEnvironment)}
                className={classnames(
                  'env-modal__sidebar-root-item',
                  {'env-modal__sidebar-item--active': activeEnvironment === rootEnvironment}
                )}>
              <button>{rootEnvironment ? rootEnvironment.name : ''}</button>
            </li>
            <div className="pad env-modal__sidebar-heading">
              <h3 className="no-margin">Sub Environments</h3>
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
                    <button onClick={() => this._handleShowEnvironment(environment)}>
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
                <PromptButton className="btn btn--clicky"
                              confirmMessage="Confirm"
                              onClick={() => this._handleDeleteEnvironment(activeEnvironment)}>
                  <i className="fa fa-trash-o"/> Delete
                </PromptButton>
              ) : null}
            </div>
            <div className="env-modal__editor">
              <EnvironmentEditor
                editorFontSize={editorFontSize}
                ref={n => this._envEditor = n}
                key={`${forceRefreshKey}::${(activeEnvironment ? activeEnvironment._id : 'n/a')}`}
                environment={activeEnvironment ? activeEnvironment.data : {}}
                didChange={this._didChange.bind(this)}
                lightTheme={true}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="margin-left faint italic txt-sm tall">
            * environment data can be used for&nbsp;
            <Link href="https://insomnia.rest/documentation/templating/">
              Nunjucks Templating
            </Link> in your requests
          </div>
          <button className="btn" disabled={!isValid}
                  onClick={e => this.modal.hide()}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

WorkspaceEnvironmentsEditModal.propTypes = {
  onChange: PropTypes.func.isRequired,
  editorFontSize: PropTypes.number.isRequired,
};

export default WorkspaceEnvironmentsEditModal;

export let show = null;

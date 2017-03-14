import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import {Dropdown, DropdownButton, DropdownItem} from '../base/dropdown';
import PromptButton from '../base/prompt-button';
import Button from '../base/button';
import Link from '../base/link';
import EnvironmentEditor from '../editors/environment-editor';
import Editable from '../base/editable';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import * as models from '../../../models';
import {trackEvent} from '../../../analytics/index';

@autobind
class WorkspaceEnvironmentsEditModal extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      workspace: null,
      isValid: true,
      subEnvironments: [],
      rootEnvironment: null,
      activeEnvironmentId: null,
      forceRefreshKey: 0
    };
  }

  _hide () {
    this.modal.hide();
  }

  _setEditorRef (n) {
    this._envEditor = n;
  }

  _setModalRef (n) {
    this.modal = n;
  }

  async show (workspace) {
    this.modal.show();
    await this._load(workspace);
    trackEvent('Environment Editor', 'Show');
  }

  async toggle (workspace) {
    this.modal.toggle();
    await this._load(workspace);
  }

  async _load (workspace, environmentToActivate = null) {
    const rootEnvironment = await models.environment.getOrCreateForWorkspace(workspace);
    const subEnvironments = await models.environment.findByParentId(rootEnvironment._id);

    let activeEnvironmentId;

    if (environmentToActivate) {
      activeEnvironmentId = environmentToActivate._id;
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
      forceRefreshKey: Date.now()
    });
  }

  async _handleAddEnvironment (isPrivate = false) {
    const {rootEnvironment, workspace} = this.state;
    const parentId = rootEnvironment._id;
    const environment = await models.environment.create({parentId, isPrivate});
    await this._load(workspace, environment);

    trackEvent(
      'Environment',
      isPrivate ? 'Create' : 'Create Private'
    );
  }

  async _handleShowEnvironment (environment) {
    // Don't allow switching if the current one has errors
    if (!this._envEditor.isValid()) {
      return;
    }

    if (environment === this._getActiveEnvironment()) {
      return;
    }

    const {workspace} = this.state;
    await this._load(workspace, environment);
    trackEvent('Environment Editor', 'Show Environment');
  }

  async _handleDeleteEnvironment () {
    const {rootEnvironment, workspace} = this.state;
    const environment = this._getActiveEnvironment();

    // Don't delete the root environment
    if (environment === rootEnvironment) {
      return;
    }

    // Delete the current one, then activate the root environment
    await models.environment.remove(environment);

    await this._load(workspace, rootEnvironment);
    trackEvent('Environment', 'Delete');
  }

  async _handleChangeEnvironmentName (environment, name) {
    const {workspace} = this.state;

    // NOTE: Fetch the environment first because it might not be up to date.
    // For example, editing the body updates silently.
    const realEnvironment = await models.environment.getById(environment._id);
    await models.environment.update(realEnvironment, {name});
    await this._load(workspace);

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
    const {
      editorFontSize,
      editorKeyMap,
      lineWrapping,
      render,
      getRenderContext
    } = this.props;

    const {
      subEnvironments,
      rootEnvironment,
      isValid,
      forceRefreshKey
    } = this.state;

    const activeEnvironment = this._getActiveEnvironment();

    return (
      <Modal ref={this._setModalRef} wide top tall {...this.props}>
        <ModalHeader>Manage Environments</ModalHeader>
        <ModalBody noScroll className="env-modal">
          <div className="env-modal__sidebar">
            <li className={classnames(
              'env-modal__sidebar-root-item',
              {'env-modal__sidebar-item--active': activeEnvironment === rootEnvironment}
            )}>
              <Button onClick={this._handleShowEnvironment} value={rootEnvironment}>
                {rootEnvironment ? rootEnvironment.name : ''}
              </Button>
            </li>
            <div className="pad env-modal__sidebar-heading">
              <h3 className="no-margin">Sub Environments</h3>
              <Dropdown right>
                <DropdownButton>
                  <i className="fa fa-plus-circle"/>
                </DropdownButton>
                <DropdownItem onClick={this._handleAddEnvironment} value={false}>
                  <i className="fa fa-eye"/> Environment
                </DropdownItem>
                <DropdownItem onClick={this._handleAddEnvironment} value={true}
                              title="Environment will not be exported or synced">
                  <i className="fa fa-eye-slash"/> Private Environment
                </DropdownItem>
              </Dropdown>
            </div>
            <ul>
              {subEnvironments.map(environment => {
                const classes = classnames(
                  'env-modal__sidebar-item',
                  {'env-modal__sidebar-item--active': activeEnvironment === environment}
                );

                return (
                  <li key={environment._id} className={classes}>
                    <Button onClick={this._handleShowEnvironment} value={environment}>
                      {environment.isPrivate ? (
                          <i className="fa fa-eye-slash faint"
                             title="Environment will not be exported or synced"
                          />
                        ) : (
                          <i className="fa fa-blank faint"/>
                        )}
                      &nbsp;&nbsp;
                      <Editable
                        className="inline-block"
                        onSubmit={name => this._handleChangeEnvironmentName(environment, name)}
                        value={environment.name}
                      />
                    </Button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="env-modal__main">
            <div className="env-modal__main__header">
              <h1>
                <Editable singleClick
                          onSubmit={name => this._handleChangeEnvironmentName(activeEnvironment, name)}
                          value={activeEnvironment ? activeEnvironment.name : ''}/>
              </h1>
              {rootEnvironment !== activeEnvironment ? (
                  <PromptButton className="btn btn--clicky"
                                confirmMessage="Confirm"
                                onClick={this._handleDeleteEnvironment}>
                    <i className="fa fa-trash-o"/> Delete
                  </PromptButton>
                ) : null}
            </div>
            <div className="env-modal__editor">
              <EnvironmentEditor
                editorFontSize={editorFontSize}
                editorKeyMap={editorKeyMap}
                lineWrapping={lineWrapping}
                ref={this._setEditorRef}
                key={`${forceRefreshKey}::${(activeEnvironment ? activeEnvironment._id : 'n/a')}`}
                environment={activeEnvironment ? activeEnvironment.data : {}}
                didChange={this._didChange}
                render={render}
                getRenderContext={getRenderContext}
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
          <button className="btn" disabled={!isValid} onClick={this._hide}>
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
  editorKeyMap: PropTypes.string.isRequired,
  render: PropTypes.func.isRequired,
  getRenderContext: PropTypes.func.isRequired,
  lineWrapping: PropTypes.bool.isRequired
};

export default WorkspaceEnvironmentsEditModal;

export let show = null;

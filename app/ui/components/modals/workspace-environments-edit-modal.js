// @flow
import * as React from 'react';
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
import {DEBOUNCE_MILLIS} from '../../../common/constants';
import type {Workspace} from '../../../models/workspace';
import type {Environment} from '../../../models/environment';

type Props = {
  activeEnvironment: Environment | null,
  editorFontSize: number,
  editorIndentSize: number,
  editorKeyMap: string,
  lineWrapping: boolean,
  render: Function,
  getRenderContext: Function,
  nunjucksPowerUserMode: boolean
};

type State = {
  workspace: Workspace | null,
  isValid: boolean,
  subEnvironments: Array<Environment>,
  rootEnvironment: Environment | null,
  selectedEnvironmentId: string | null
};

@autobind
class WorkspaceEnvironmentsEditModal extends React.PureComponent<Props, State> {
  environmentEditorRef: EnvironmentEditor | null;
  colorChangeTimeout: any;
  modal: Modal;

  constructor (props: Props) {
    super(props);
    this.state = {
      workspace: null,
      isValid: true,
      subEnvironments: [],
      rootEnvironment: null,
      selectedEnvironmentId: null
    };

    this.colorChangeTimeout = null;
  }

  hide () {
    this.modal && this.modal.hide();
  }

  _setEditorRef (n: EnvironmentEditor) {
    this.environmentEditorRef = n;
  }

  _setModalRef (n: Modal | null) {
    this.modal = n;
  }

  async show (workspace: Workspace) {
    const {activeEnvironment} = this.props;

    // Default to showing the currently active environment
    if (activeEnvironment) {
      this.setState({selectedEnvironmentId: activeEnvironment._id});
    }

    await this._load(workspace);

    this.modal && this.modal.show();
    trackEvent('Environment Editor', 'Show');
  }

  async _load (workspace: Workspace | null, environmentToActivate: Environment | null = null) {
    if (!workspace) {
      console.warn('Failed to reload environment editor without Workspace');
      return;
    }

    const rootEnvironment = await models.environment.getOrCreateForWorkspace(workspace);
    const subEnvironments = await models.environment.findByParentId(rootEnvironment._id);

    let selectedEnvironmentId;

    if (environmentToActivate) {
      selectedEnvironmentId = environmentToActivate._id;
    } else if (this.state.workspace && workspace._id !== this.state.workspace._id) {
      // We've changed workspaces, so load the root one
      selectedEnvironmentId = rootEnvironment._id;
    } else {
      // We haven't changed workspaces, so try loading the last environment, and fall back
      // to the root one
      selectedEnvironmentId = this.state.selectedEnvironmentId || rootEnvironment._id;
    }

    this.setState({
      workspace,
      rootEnvironment,
      subEnvironments,
      selectedEnvironmentId
    });
  }

  async _handleAddEnvironment (isPrivate: boolean = false) {
    const {rootEnvironment, workspace} = this.state;

    if (!rootEnvironment) {
      console.warn('Failed to add environment. Unknown root environment');
      return;
    }

    const parentId = rootEnvironment._id;
    const environment = await models.environment.create({parentId, isPrivate});
    await this._load(workspace, environment);

    trackEvent(
      'Environment',
      isPrivate ? 'Create' : 'Create Private'
    );
  }

  async _handleShowEnvironment (environment: Environment) {
    // Don't allow switching if the current one has errors
    if (this.environmentEditorRef && !this.environmentEditorRef.isValid()) {
      return;
    }

    if (environment === this._getActiveEnvironment()) {
      return;
    }

    const {workspace} = this.state;

    await this._load(workspace, environment);
    trackEvent('Environment Editor', 'Show Environment');
  }

  async _handleDeleteEnvironment (environment: Environment) {
    const {rootEnvironment, workspace} = this.state;

    // Don't delete the root environment
    if (environment === rootEnvironment) {
      return;
    }

    // Delete the current one, then activate the root environment
    await models.environment.remove(environment);
    await this._load(workspace, rootEnvironment);
    trackEvent('Environment', 'Delete');
  }

  async _handleChangeEnvironmentName (environment: Environment, name: string) {
    const {workspace} = this.state;

    // NOTE: Fetch the environment first because it might not be up to date.
    // For example, editing the body updates silently.
    const realEnvironment = await models.environment.getById(environment._id);

    if (!realEnvironment) {
      return;
    }

    await models.environment.update(realEnvironment, {name});
    await this._load(workspace);

    trackEvent('Environment', 'Rename');
  }

  _handleChangeEnvironmentColor (environment: Environment, color: string | null) {
    clearTimeout(this.colorChangeTimeout);
    this.colorChangeTimeout = setTimeout(async () => {
      const {workspace} = this.state;
      await models.environment.update(environment, {color});
      await this._load(workspace);

      trackEvent('Environment', color ? 'Change Color' : 'Unset Color');
    }, DEBOUNCE_MILLIS);
  }

  _didChange () {
    const isValid = this.environmentEditorRef ? this.environmentEditorRef.isValid() : false;

    if (this.state.isValid !== isValid) {
      this.setState({isValid});
    }

    this._saveChanges();
  }

  _getActiveEnvironment (): Environment | null {
    const {selectedEnvironmentId, subEnvironments, rootEnvironment} = this.state;
    if (rootEnvironment && rootEnvironment._id === selectedEnvironmentId) {
      return rootEnvironment;
    } else {
      return subEnvironments.find(e => e._id === selectedEnvironmentId) || null;
    }
  }

  _handleUnsetColor (environment: Environment) {
    this._handleChangeEnvironmentColor(environment, null);
  }

  async _handleClickColorChange (environment: Environment) {
    let el = document.querySelector('#env-color-picker');

    if (!el) {
      el = document.createElement('input');
      el.id = 'env-color-picker';
      el.type = 'color';
      document.body && document.body.appendChild(el);
    }

    let color = environment.color || '#7d69cb';

    if (!environment.color) {
      await this._handleChangeEnvironmentColor(environment, color);
    }

    el.setAttribute('value', color);
    el.addEventListener('input', (e: Event) => {
      if (e.target instanceof HTMLInputElement) {
        this._handleChangeEnvironmentColor(environment, e.target && e.target.value);
      }
    });

    el.click();
  }

  _saveChanges () {
    // Only save if it's valid
    if (!this.environmentEditorRef || !this.environmentEditorRef.isValid()) {
      return;
    }

    const data = this.environmentEditorRef.getValue();
    const activeEnvironment = this._getActiveEnvironment();

    if (activeEnvironment) {
      models.environment.update(activeEnvironment, {data});
    }
  }

  render () {
    const {
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      lineWrapping,
      render,
      getRenderContext,
      nunjucksPowerUserMode
    } = this.props;

    const {
      subEnvironments,
      rootEnvironment,
      isValid
    } = this.state;

    const activeEnvironment = this._getActiveEnvironment();

    return (
      <Modal ref={this._setModalRef} wide tall {...this.props}>
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
                      {environment.color
                        ? <i className="space-right fa fa-circle"
                             style={{color: environment.color}}/>
                        : <i className="space-right fa fa-empty"/>
                      }

                      {environment.isPrivate
                        ? <i className="fa fa-eye-slash faint space-right"
                             title="Environment will not be exported or synced"/>
                        : null
                      }

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
                          className="wide"
                          onSubmit={
                            name => activeEnvironment && this._handleChangeEnvironmentName(activeEnvironment, name)}
                          value={activeEnvironment ? activeEnvironment.name : ''}/>
              </h1>

              {activeEnvironment && rootEnvironment !== activeEnvironment ? (
                <Dropdown className="space-right" right>
                  <DropdownButton className="btn btn--clicky">
                    {activeEnvironment.color && (
                      <i className="fa fa-circle space-right"
                         style={{color: activeEnvironment.color}}/>
                    )}
                    Color <i className="fa fa-caret-down"/>
                  </DropdownButton>

                  <DropdownItem value={activeEnvironment} onClick={this._handleClickColorChange}>
                    <i className="fa fa-circle" style={{color: activeEnvironment.color}}/>
                    {activeEnvironment.color ? 'Change Color' : 'Assign Color'}
                  </DropdownItem>

                  <DropdownItem value={activeEnvironment}
                                onClick={this._handleUnsetColor}
                                disabled={!activeEnvironment.color}>
                    <i className="fa fa-minus-circle"/>
                    Unset Color
                  </DropdownItem>
                </Dropdown>
              ) : null}

              {activeEnvironment && rootEnvironment !== activeEnvironment ? (
                <PromptButton
                  value={activeEnvironment}
                  onClick={this._handleDeleteEnvironment}
                  className="btn btn--clicky">
                  <i className="fa fa-trash-o"/>
                </PromptButton>
              ) : null}
            </div>
            <div className="env-modal__editor">
              <EnvironmentEditor
                editorFontSize={editorFontSize}
                editorIndentSize={editorIndentSize}
                editorKeyMap={editorKeyMap}
                lineWrapping={lineWrapping}
                ref={this._setEditorRef}
                key={activeEnvironment ? activeEnvironment._id : 'n/a'}
                environment={activeEnvironment ? activeEnvironment.data : {}}
                didChange={this._didChange}
                render={render}
                getRenderContext={getRenderContext}
                nunjucksPowerUserMode={nunjucksPowerUserMode}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="margin-left italic txt-sm tall">
            * Environment data can be used for&nbsp;
            <Link href="https://insomnia.rest/documentation/templating/">
              Nunjucks Templating
            </Link> in your requests
          </div>
          <button className="btn" disabled={!isValid} onClick={this.hide}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

export default WorkspaceEnvironmentsEditModal;

import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { Fragment, PureComponent } from 'react';
import { arrayMove, SortableContainer, SortableElement, SortEndHandler } from 'react-sortable-hoc';

import { AUTOBIND_CFG, DEBOUNCE_MILLIS } from '../../../common/constants';
import { database as db } from '../../../common/database';
import { docsTemplateTags } from '../../../common/documentation';
import { HandleGetRenderContext, HandleRender } from '../../../common/render';
import * as models from '../../../models';
import type { Environment } from '../../../models/environment';
import type { Workspace } from '../../../models/workspace';
import { Button, ButtonProps } from '../base/button';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { Editable } from '../base/editable';
import { Link } from '../base/link';
import { Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
import { EnvironmentEditor } from '../editors/environment-editor';
import { HelpTooltip } from '../help-tooltip';
import { Tooltip } from '../tooltip';
const ROOT_ENVIRONMENT_NAME = 'Base Environment';

interface Props extends ModalProps {
  handleChangeEnvironment: (id: string | null) => void;
  activeEnvironmentId: string | null;
  editorFontSize: number;
  editorIndentSize: number;
  editorKeyMap: string;
  lineWrapping: boolean;
  render: HandleRender;
  getRenderContext: HandleGetRenderContext;
  nunjucksPowerUserMode: boolean;
  isVariableUncovered: boolean;
}

interface State {
  workspace: Workspace | null;
  isValid: boolean;
  subEnvironments: Environment[];
  rootEnvironment: Environment | null;
  selectedEnvironmentId: string | null;
}

interface SidebarListItemProps extends Pick<Props, 'activeEnvironmentId'> {
  changeEnvironmentName: (environment: Environment, name?: string) => void;
  environment: Environment;
  handleActivateEnvironment: ButtonProps<Environment>['onClick'];
  selectedEnvironment: Environment | null;
  showEnvironment: ButtonProps<Environment>['onClick'];
}

const SidebarListItem = SortableElement<SidebarListItemProps>(({
  activeEnvironmentId,
  changeEnvironmentName,
  environment,
  handleActivateEnvironment,
  selectedEnvironment,
  showEnvironment,
}) => {
  const classes = classnames({
    'env-modal__sidebar-item': true,
    'env-modal__sidebar-item--active': selectedEnvironment === environment,
    // Specify theme because dragging will pull it out to <body>
    'theme--dialog': true,
  });
  return (
    <li key={environment._id} className={classes}>
      <Button onClick={showEnvironment} value={environment}>
        <i className="fa fa-drag-handle drag-handle" />
        {environment.color ? (
          <i
            className="space-right fa fa-circle"
            style={{
              color: environment.color,
            }}
          />
        ) : (
          <i className="space-right fa fa-empty" />
        )}

        {environment.isPrivate && (
          <Tooltip position="top" message="Environment will not be exported or synced">
            <i className="fa fa-eye-slash faint space-right" />
          </Tooltip>
        )}

        <Editable
          className="inline-block"
          onSubmit={name => changeEnvironmentName(environment, name)}
          value={environment.name}
        />
      </Button>
      <div className="env-status">
        {environment._id === activeEnvironmentId ? (
          <i className="fa fa-square active" title="Active Environment" />
        ) : (
          <Button onClick={handleActivateEnvironment} value={environment}>
            <i className="fa fa-square-o inactive" title="Click to activate Environment" />
          </Button>
        )}
      </div>
    </li>
  );
},
);

interface SidebarListProps extends Omit<SidebarListItemProps, 'environment'> {
  environments: Environment[];
}

const SidebarList = SortableContainer<SidebarListProps>(
  ({
    activeEnvironmentId,
    changeEnvironmentName,
    environments,
    handleActivateEnvironment,
    selectedEnvironment,
    showEnvironment,
  }) => (
    <ul>
      {environments.map((environment, index) => (
        <SidebarListItem
          activeEnvironmentId={activeEnvironmentId}
          changeEnvironmentName={changeEnvironmentName}
          environment={environment}
          handleActivateEnvironment={handleActivateEnvironment}
          index={index}
          key={environment._id}
          selectedEnvironment={selectedEnvironment}
          showEnvironment={showEnvironment}
        />
      ))}
    </ul>
  ),
);

@autoBindMethodsForReact(AUTOBIND_CFG)
export class WorkspaceEnvironmentsEditModal extends PureComponent<Props, State> {
  environmentEditorRef: EnvironmentEditor | null = null;
  environmentColorInputRef: HTMLInputElement | null = null;
  saveTimeout: NodeJS.Timeout | null = null;
  modal: Modal | null = null;
  editorKey = 0;

  state: State = {
    workspace: null,
    isValid: true,
    subEnvironments: [],
    rootEnvironment: null,
    selectedEnvironmentId: null,
  };

  colorChangeTimeout: NodeJS.Timeout | null = null;

  hide() {
    this.modal?.hide();
  }

  _setEditorRef(n: EnvironmentEditor) {
    this.environmentEditorRef = n;
  }

  _setModalRef(n: Modal) {
    this.modal = n;
  }

  async show(workspace: Workspace) {
    const { activeEnvironmentId } = this.props;

    // Default to showing the currently active environment
    if (activeEnvironmentId) {
      this.setState({
        selectedEnvironmentId: activeEnvironmentId,
      });
    }

    await this._load(workspace);
    this.modal?.show();
  }

  async _load(workspace: Workspace | null, environmentToSelect: Environment | null = null) {
    if (!workspace) {
      console.warn('Failed to reload environment editor without Workspace');
      return;
    }

    const rootEnvironment = await models.environment.getOrCreateForParentId(workspace._id);
    const subEnvironments = await models.environment.findByParentId(rootEnvironment._id);
    let selectedEnvironmentId;

    if (environmentToSelect) {
      selectedEnvironmentId = environmentToSelect._id;
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
      selectedEnvironmentId,
    });
  }

  async _handleAddEnvironment(isPrivate = false) {
    const { rootEnvironment, workspace } = this.state;

    if (!rootEnvironment) {
      console.warn('Failed to add environment. Unknown root environment');
      return;
    }

    const parentId = rootEnvironment._id;
    const environment = await models.environment.create({
      parentId,
      isPrivate,
    });
    await this._load(workspace, environment);
  }

  _handleShowEnvironment(environment: Environment) {
    // Don't allow switching if the current one has errors
    if (this.environmentEditorRef && !this.environmentEditorRef.isValid()) {
      return;
    }

    if (environment === this._getSelectedEnvironment()) {
      return;
    }

    const { workspace } = this.state;
    this._load(workspace, environment);
  }

  async _handleDuplicateEnvironment(environment: Environment) {
    const { workspace } = this.state;
    const newEnvironment = await models.environment.duplicate(environment);
    await this._load(workspace, newEnvironment);
  }

  async _handleDeleteEnvironment(environment: Environment) {
    const { handleChangeEnvironment, activeEnvironmentId } = this.props;
    const { rootEnvironment, workspace } = this.state;

    // Don't delete the root environment
    if (environment === rootEnvironment) {
      return;
    }

    // Unset active environment if it's being deleted
    if (activeEnvironmentId === environment._id) {
      handleChangeEnvironment(null);
    }

    // Delete the current one
    await models.environment.remove(environment);
    await this._load(workspace, rootEnvironment);
  }

  async _updateEnvironment(
    environment: Environment | null,
    patch: Partial<Environment>,
    refresh = true,
  ) {
    if (environment === null) {
      return;
    }

    const { workspace } = this.state;
    // NOTE: Fetch the environment first because it might not be up to date.
    // For example, editing the body updates silently.
    const realEnvironment = await models.environment.getById(environment._id);

    if (!realEnvironment) {
      return;
    }

    await models.environment.update(realEnvironment, patch);

    if (refresh) {
      await this._load(workspace);
    }
  }

  async _handleChangeEnvironmentName(environment: Environment, name: string) {
    await this._updateEnvironment(environment, {
      name,
    });
  }

  _handleChangeEnvironmentColor(environment: Environment | null, color: string | null) {
    if (this.colorChangeTimeout !== null) {
      clearTimeout(this.colorChangeTimeout);
    }
    this.colorChangeTimeout = setTimeout(async () => {
      await this._updateEnvironment(environment, { color });
    }, DEBOUNCE_MILLIS);
  }

  _didChange() {
    this._saveChanges();

    // Call this last in case component unmounted
    const isValid = this.environmentEditorRef ? this.environmentEditorRef.isValid() : false;

    if (this.state.isValid !== isValid) {
      this.setState({
        isValid,
      });
    }
  }

  _getSelectedEnvironment(): Environment | null {
    const { selectedEnvironmentId, subEnvironments, rootEnvironment } = this.state;

    if (rootEnvironment && rootEnvironment._id === selectedEnvironmentId) {
      return rootEnvironment;
    } else {
      return subEnvironments.find(e => e._id === selectedEnvironmentId) || null;
    }
  }

  componentDidMount() {
    db.onChange(async changes => {
      const { selectedEnvironmentId } = this.state;

      for (const change of changes) {
        const [, doc, fromSync] = change;

        // Force an editor refresh if any changes from sync come in
        if (doc._id === selectedEnvironmentId && fromSync) {
          this.editorKey = doc.modified;
          await this._load(this.state.workspace);
        }
      }
    });
  }

  _handleSortEnd: SortEndHandler = results => {
    const { oldIndex, newIndex } = results;

    if (newIndex === oldIndex) {
      return;
    }

    const { subEnvironments } = this.state;
    const newSubEnvironments = arrayMove(subEnvironments, oldIndex, newIndex);
    this.setState({
      subEnvironments: newSubEnvironments,
    });
    // Do this last so we don't block the sorting
    db.bufferChanges();

    Promise.all(newSubEnvironments.map((environment, index) => this._updateEnvironment(
      environment,
      { metaSortKey: index },
      false,
    ))).then(() => {
      db.flushChanges();
    });
  };

  _handleClickColorChange(environment: Environment) {
    if (!environment.color) {
      // TODO: fix magic-number. Currently this is the `surprise` background color for the default theme, but we should be grabbing the actual value from the user's actual theme instead.
      this._handleChangeEnvironmentColor(environment, '#7d69cb');
    }

    this.environmentColorInputRef?.click();
  }

  _saveChanges() {
    // Only save if it's valid
    if (!this.environmentEditorRef || !this.environmentEditorRef.isValid()) {
      return;
    }

    let patch;

    try {
      const data = this.environmentEditorRef.getValue();
      patch = {
        data: data && data.object,
        dataPropertyOrder: data && data.propertyOrder,
      };
    } catch (err) {
      // Invalid JSON probably
      return;
    }

    const selectedEnvironment = this._getSelectedEnvironment();

    if (selectedEnvironment) {
      if (this.saveTimeout !== null) {
        clearTimeout(this.saveTimeout);
      }
      this.saveTimeout = setTimeout(async () => {
        await this._updateEnvironment(selectedEnvironment, patch);
      }, DEBOUNCE_MILLIS * 4);
    }
  }

  handleInputColorChage(event: React.ChangeEvent<HTMLInputElement>) {
    this._handleChangeEnvironmentColor(this._getSelectedEnvironment(), event.target.value);
  }

  unsetColor(environment: Environment) {
    this._handleChangeEnvironmentColor(environment, null);
  }

  _handleActivateEnvironment: ButtonProps<Environment>['onClick'] = (environment: Environment) => {
    const { handleChangeEnvironment, activeEnvironmentId } = this.props;

    if (environment._id === activeEnvironmentId) {
      return;
    }

    handleChangeEnvironment(environment._id);
    this._handleShowEnvironment(environment);
  };

  render() {
    const {
      activeEnvironmentId,
      editorFontSize,
      editorIndentSize,
      editorKeyMap,
      getRenderContext,
      isVariableUncovered,
      lineWrapping,
      nunjucksPowerUserMode,
      render,
    } = this.props;
    const { subEnvironments, rootEnvironment, isValid } = this.state;

    const selectedEnvironment = this._getSelectedEnvironment();

    if (this.environmentColorInputRef !== null) {
      this.environmentColorInputRef.value = selectedEnvironment?.color || '';
    }

    const environmentInfo = {
      object: selectedEnvironment ? selectedEnvironment.data : {},
      propertyOrder: selectedEnvironment && selectedEnvironment.dataPropertyOrder,
    };

    return (
      <Modal ref={this._setModalRef} wide tall {...this.props}>
        <ModalHeader>Manage Environments</ModalHeader>
        <ModalBody noScroll className="env-modal">
          <div className="env-modal__sidebar">
            <li
              className={classnames('env-modal__sidebar-root-item', {
                'env-modal__sidebar-item--active': selectedEnvironment === rootEnvironment,
              })}
            >
              <Button onClick={this._handleShowEnvironment} value={rootEnvironment}>
                {ROOT_ENVIRONMENT_NAME}
                <HelpTooltip className="space-left">
                  The variables in this environment are always available, regardless of which
                  sub-environment is active. Useful for storing default or fallback values.
                </HelpTooltip>
              </Button>
            </li>
            <div className="pad env-modal__sidebar-heading">
              <h3 className="no-margin">Sub Environments</h3>
              <Dropdown right>
                <DropdownButton>
                  <i className="fa fa-plus-circle" />
                  <i className="fa fa-caret-down" />
                </DropdownButton>
                <DropdownItem onClick={this._handleAddEnvironment} value={false}>
                  <i className="fa fa-eye" /> Environment
                </DropdownItem>
                <DropdownItem
                  onClick={this._handleAddEnvironment}
                  value={true}
                  title="Environment will not be exported or synced"
                >
                  <i className="fa fa-eye-slash" /> Private Environment
                </DropdownItem>
              </Dropdown>
            </div>
            <SidebarList
              activeEnvironmentId={activeEnvironmentId}
              handleActivateEnvironment={this._handleActivateEnvironment}
              environments={subEnvironments}
              selectedEnvironment={selectedEnvironment}
              showEnvironment={this._handleShowEnvironment}
              changeEnvironmentName={this._handleChangeEnvironmentName}
              onSortEnd={this._handleSortEnd}
              helperClass="env-modal__sidebar-item--dragging"
              transitionDuration={0}
              useWindowAsScrollContainer={false}
            />
          </div>
          <div className="env-modal__main">
            <div className="env-modal__main__header">
              <h1>
                {rootEnvironment === selectedEnvironment ? (
                  ROOT_ENVIRONMENT_NAME
                ) : (
                  <Editable
                    singleClick
                    className="wide"
                    onSubmit={name => {
                      if (!selectedEnvironment || !name) {
                        return;
                      }
                      this._handleChangeEnvironmentName(selectedEnvironment, name);
                    }}
                    value={selectedEnvironment ? selectedEnvironment.name : ''}
                  />
                )}
              </h1>

              {selectedEnvironment && rootEnvironment !== selectedEnvironment ? (
                <Fragment>
                  <input
                    className="hidden"
                    type="color"
                    ref={ref => { this.environmentColorInputRef = ref; }}
                    onChange={this.handleInputColorChage}
                  />

                  <Dropdown className="space-right" right>
                    <DropdownButton className="btn btn--clicky">
                      {selectedEnvironment.color && (
                        <i
                          className="fa fa-circle space-right"
                          style={{
                            color: selectedEnvironment.color,
                          }}
                        />
                      )}
                      Color <i className="fa fa-caret-down" />
                    </DropdownButton>

                    <DropdownItem value={selectedEnvironment} onClick={this._handleClickColorChange}>
                      <i
                        className="fa fa-circle"
                        style={{
                          ...(selectedEnvironment.color ? { color: selectedEnvironment.color } : {}),
                        }}
                      />
                      {selectedEnvironment.color ? 'Change Color' : 'Assign Color'}
                    </DropdownItem>

                    <DropdownItem
                      value={selectedEnvironment}
                      onClick={this.unsetColor}
                      disabled={!selectedEnvironment.color}
                    >
                      <i className="fa fa-minus-circle" />
                      Unset Color
                    </DropdownItem>
                  </Dropdown>

                  <Button
                    value={selectedEnvironment}
                    onClick={this._handleDuplicateEnvironment}
                    className="btn btn--clicky space-right"
                  >
                    <i className="fa fa-copy" /> Duplicate
                  </Button>

                  <PromptButton
                    value={selectedEnvironment}
                    onClick={this._handleDeleteEnvironment}
                    className="btn btn--clicky"
                  >
                    <i className="fa fa-trash-o" />
                  </PromptButton>
                </Fragment>
              ) : null}
            </div>
            <div className="env-modal__editor">
              <EnvironmentEditor
                editorFontSize={editorFontSize}
                editorIndentSize={editorIndentSize}
                editorKeyMap={editorKeyMap}
                lineWrapping={lineWrapping}
                ref={this._setEditorRef}
                key={`${this.editorKey}::${selectedEnvironment ? selectedEnvironment._id : 'n/a'}`}
                environmentInfo={environmentInfo}
                didChange={this._didChange}
                render={render}
                getRenderContext={getRenderContext}
                nunjucksPowerUserMode={nunjucksPowerUserMode}
                isVariableUncovered={isVariableUncovered}
              />
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <div className="margin-left italic txt-sm">
            * Environment data can be used for&nbsp;
            <Link href={docsTemplateTags}>Nunjucks Templating</Link> in your requests
          </div>
          <button className="btn" disabled={!isValid} onClick={this.hide}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

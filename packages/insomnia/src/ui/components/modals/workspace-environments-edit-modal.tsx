import classnames from 'classnames';
import React, { forwardRef, Fragment, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { arrayMove, SortableContainer, SortableElement, SortEndHandler } from 'react-sortable-hoc';

import { database as db } from '../../../common/database';
import { docsTemplateTags } from '../../../common/documentation';
import * as models from '../../../models';
import type { Environment } from '../../../models/environment';
import type { Workspace } from '../../../models/workspace';
import { selectActiveWorkspace } from '../../redux/selectors';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { Editable } from '../base/editable';
import { Link } from '../base/link';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
import { EnvironmentEditor } from '../editors/environment-editor';
import { HelpTooltip } from '../help-tooltip';
import { Tooltip } from '../tooltip';
const ROOT_ENVIRONMENT_NAME = 'Base Environment';

interface Props extends ModalProps {
  handleSetActiveEnvironment: (id: string | null) => void;
  activeEnvironmentId: string | null;
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
  handleActivateEnvironment: (e: Environment) => void;
  selectedEnvironment: Environment | null;
  showEnvironment: (e: Environment) => void;
}

const SidebarListItem = SortableElement<SidebarListItemProps>(({
  activeEnvironmentId,
  changeEnvironmentName,
  environment,
  handleActivateEnvironment,
  selectedEnvironment,
  showEnvironment,
}: SidebarListItemProps) => {
  const classes = classnames({
    'env-modal__sidebar-item': true,
    'env-modal__sidebar-item--active': selectedEnvironment === environment,
    // Specify theme because dragging will pull it out to <body>
    'theme--dialog': true,
  });
  return (
    <li key={environment._id} className={classes}>
      <button onClick={() => showEnvironment(environment)}>
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
      </button>
      <div className="env-status">
        {environment._id === activeEnvironmentId ? (
          <i className="fa fa-square active" title="Active Environment" />
        ) : (
          <button onClick={() => handleActivateEnvironment(environment)}>
            <i className="fa fa-square-o inactive" title="Click to activate Environment" />
          </button>
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
  }: SidebarListProps) => (
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

export interface WorkspaceEnvironmentsEditModalHandle {
  show: () => void;
  hide: () => void;
}
export const WorkspaceEnvironmentsEditModal = forwardRef<WorkspaceEnvironmentsEditModalHandle, Props>((props, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const editorRef = useRef<EnvironmentEditor>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<State>({
    workspace: null,
    isValid: true,
    subEnvironments: [],
    rootEnvironment: null,
    selectedEnvironmentId: null,
  });

  const workspace = useSelector(selectActiveWorkspace);

  const _load = useCallback(async (environmentToSelect: Environment | null = null) => {
    if (!workspace) {
      console.warn('Failed to reload environment editor without Workspace');
      return;
    }

    const rootEnvironment = await models.environment.getOrCreateForParentId(workspace._id);
    const subEnvironments = await models.environment.findByParentId(rootEnvironment._id);
    let selectedEnvironmentId: string;

    if (environmentToSelect) {
      selectedEnvironmentId = environmentToSelect._id;
    } else {
      // We haven't changed workspaces, so try loading the last environment, and fall back
      // to the root one
      selectedEnvironmentId = state.selectedEnvironmentId || rootEnvironment._id;
    }

    setState(state => ({
      ...state,
      rootEnvironment,
      subEnvironments,
      selectedEnvironmentId,
    }));
  }, [state.selectedEnvironmentId, workspace]);

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: () => {
      // Default to showing the currently active environment
      if (props.activeEnvironmentId) {
        setState(state => ({
          ...state,
          selectedEnvironmentId: props.activeEnvironmentId,
        }));
      }
      _load();
      modalRef.current?.show();
    },
  }), [_load, props]);

  function _handleShowEnvironment(environment?: Environment) {
    // Don't allow switching if the current one has errors
    if (editorRef.current?.isValid() && environment === getSelectedEnvironment()) {
      _load(environment);
    }
  }

  async function _handleDeleteEnvironment(environment?: Environment) {
    const { handleSetActiveEnvironment, activeEnvironmentId } = props;
    const { rootEnvironment } = state;
    // Don't delete the root environment
    if (environment === rootEnvironment) {
      return;
    }
    // Unset active environment if it's being deleted
    // TODO: unsound non-null assertion
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    if (activeEnvironmentId === environment!._id) {
      handleSetActiveEnvironment(null);
    }
    // Delete the current one
    // TODO: unsound non-null assertion
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    await models.environment.remove(environment!);
    _load(rootEnvironment);
  }

  async function updateEnvironment(
    environment: Environment | null,
    patch: Partial<Environment>,
  ) {
    if (environment === null) {
      return;
    }
    // NOTE: Fetch the environment first because it might not be up to date.
    // For example, editing the body updates silently.
    const realEnvironment = await models.environment.getById(environment._id);
    if (!realEnvironment) {
      return;
    }
    await models.environment.update(realEnvironment, patch);
  }

  async function _handleChangeEnvironmentName(environment: Environment, name?: string) {
    updateEnvironment(environment, { name });
  }

  function _didChange() {
    _saveChanges();
    // Call this last in case component unmounted
    const isValid = editorRef.current ? editorRef.current.isValid() : false;
    if (state.isValid !== isValid) {
      setState(state => ({
        ...state,
        isValid,
      }));
    }
  }

  const getSelectedEnvironment = (): Environment | null => {
    const { selectedEnvironmentId, subEnvironments, rootEnvironment } = state;
    if (rootEnvironment && rootEnvironment._id === selectedEnvironmentId) {
      return rootEnvironment;
    } else {
      return subEnvironments.find(subEnvironment => subEnvironment._id === selectedEnvironmentId) || null;
    }
  };

  // @TODO: ensure changes from sync cause re-render
  const _handleSortEnd: SortEndHandler = results => {
    const { oldIndex, newIndex } = results;
    if (newIndex === oldIndex) {
      return;
    }
    const { subEnvironments } = state;
    const newSubEnvironments = arrayMove(subEnvironments, oldIndex, newIndex);
    setState(state => ({
      ...state,
      subEnvironments: newSubEnvironments,
    }));
    // Do this last so we don't block the sorting
    db.bufferChanges();
    Promise.all(newSubEnvironments.map((environment, index) => updateEnvironment(
      environment,
      { metaSortKey: index },
    ))).then(() => {
      db.flushChanges();
    });
  };

  function _handleClickColorChange(environment: Environment) {
    if (!environment.color) {
      // TODO: fix magic-number. Currently this is the `surprise` background color for the default theme, but we should be grabbing the actual value from the user's actual theme instead.
      updateEnvironment(environment, { color: '#7d69cb' });
    }
    inputRef.current?.click();
  }

  function _saveChanges() {
    // Only save if it's valid
    if (!editorRef.current || !editorRef.current?.isValid()) {
      return;
    }
    let patch: Partial<Environment>;
    try {
      const data = editorRef.current?.getValue();
      patch = {
        data: data?.object,
        dataPropertyOrder: data && data.propertyOrder,
      };
    } catch (err) {
      // Invalid JSON probably
      return;
    }
    const selectedEnvironment = getSelectedEnvironment();
    if (selectedEnvironment) {
      updateEnvironment(selectedEnvironment, patch);
    }
  }

  const _handleActivateEnvironment = (environment: Environment) => {
    const { handleSetActiveEnvironment, activeEnvironmentId } = props;
    if (!environment) {
      return;
    }
    if (environment._id === activeEnvironmentId) {
      return;
    }
    handleSetActiveEnvironment(environment._id);
    _handleShowEnvironment(environment);
  };
  const { subEnvironments, rootEnvironment, isValid } = state;

  const selectedEnvironment = getSelectedEnvironment();

  if (inputRef.current) {
    inputRef.current.value = selectedEnvironment?.color || '';
  }
  const environmentInfo = {
    object: selectedEnvironment ? selectedEnvironment.data : {},
    propertyOrder: selectedEnvironment && selectedEnvironment.dataPropertyOrder,
  };
  return (
    <Modal ref={modalRef} wide tall {...props}>
      <ModalHeader>Manage Environments</ModalHeader>
      <ModalBody noScroll className="env-modal">
        <div className="env-modal__sidebar">
          <li
            className={classnames('env-modal__sidebar-root-item', {
              'env-modal__sidebar-item--active': selectedEnvironment === rootEnvironment,
            })}
          >
            <button onClick={() => _handleShowEnvironment(rootEnvironment ?? undefined)}>
              {ROOT_ENVIRONMENT_NAME}
              <HelpTooltip className="space-left">
                The variables in this environment are always available, regardless of which
                sub-environment is active. Useful for storing default or fallback values.
              </HelpTooltip>
            </button>
          </li>
          <div className="pad env-modal__sidebar-heading">
            <h3 className="no-margin">Sub Environments</h3>
            <Dropdown right>
              <DropdownButton>
                <i className="fa fa-plus-circle" />
                <i className="fa fa-caret-down" />
              </DropdownButton>
              <DropdownItem
                onClick={async () => {
                  const environment = await models.environment.create({
                    parentId: state.rootEnvironment?._id,
                    isPrivate: false,
                  });
                  _load(environment);
                }}
              >
                <i className="fa fa-eye" /> Environment
              </DropdownItem>
              <DropdownItem
                onClick={async () => {
                  const environment = await models.environment.create({
                    parentId: state.rootEnvironment?._id,
                    isPrivate: true,
                  });
                  _load(environment);
                }}
                title="Environment will not be exported or synced"
              >
                <i className="fa fa-eye-slash" /> Private Environment
              </DropdownItem>
            </Dropdown>
          </div>
          <SidebarList
            activeEnvironmentId={props.activeEnvironmentId}
            handleActivateEnvironment={_handleActivateEnvironment}
            environments={subEnvironments}
            selectedEnvironment={selectedEnvironment}
            showEnvironment={_handleShowEnvironment}
            changeEnvironmentName={_handleChangeEnvironmentName}
            onSortEnd={_handleSortEnd}
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
                    _handleChangeEnvironmentName(selectedEnvironment, name);
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
                  ref={inputRef}
                  onChange={event => updateEnvironment(getSelectedEnvironment(), { color: event.target.value })}
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

                  <DropdownItem onClick={() => _handleClickColorChange(selectedEnvironment)}>
                    <i
                      className="fa fa-circle"
                      style={{
                        ...(selectedEnvironment.color ? { color: selectedEnvironment.color } : {}),
                      }}
                    />
                    {selectedEnvironment.color ? 'Change Color' : 'Assign Color'}
                  </DropdownItem>

                  <DropdownItem
                    onClick={() => updateEnvironment(selectedEnvironment, { color: null })}
                    disabled={!selectedEnvironment.color}
                  >
                    <i className="fa fa-minus-circle" />
                    Unset Color
                  </DropdownItem>
                </Dropdown>

                <button
                  onClick={async () => {
                    const newEnvironment = await models.environment.duplicate(selectedEnvironment);
                    _load(newEnvironment);
                  }}
                  className="btn btn--clicky space-right"
                >
                  <i className="fa fa-copy" /> Duplicate
                </button>

                <PromptButton
                  onClick={() => _handleDeleteEnvironment(selectedEnvironment)}
                  className="btn btn--clicky"
                >
                  <i className="fa fa-trash-o" />
                </PromptButton>
              </Fragment>
            ) : null}
          </div>
          <div className="env-modal__editor">
            <EnvironmentEditor
              ref={editorRef}
              key={`${selectedEnvironment ? selectedEnvironment._id : 'n/a'}`}
              environmentInfo={environmentInfo}
              didChange={_didChange}
            />
          </div>
        </div>
      </ModalBody>
      <ModalFooter>
        <div className="margin-left italic txt-sm">
          * Environment data can be used for&nbsp;
          <Link href={docsTemplateTags}>Nunjucks Templating</Link> in your requests
        </div>
        <button className="btn" disabled={!isValid} onClick={() => modalRef.current?.hide()}>
          Done
        </button>
      </ModalFooter>
    </Modal>
  );
});
WorkspaceEnvironmentsEditModal.displayName = 'WorkspaceEnvironmentsEditModal';

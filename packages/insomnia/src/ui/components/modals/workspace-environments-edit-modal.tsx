import classnames from 'classnames';
import React, { FC, forwardRef, Fragment, useImperativeHandle, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { docsTemplateTags } from '../../../common/documentation';
import * as models from '../../../models';
import type { Environment } from '../../../models/environment';
import { selectActiveWorkspace, selectActiveWorkspaceMeta, selectEnvironments } from '../../redux/selectors';
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
import { EnvironmentEditor, EnvironmentEditorHandle } from '../editors/environment-editor';
import { HelpTooltip } from '../help-tooltip';
import { Tooltip } from '../tooltip';
const ROOT_ENVIRONMENT_NAME = 'Base Environment';

interface SidebarListProps {
  environments: Environment[];
  changeEnvironmentName: (environment: Environment, name?: string) => void;
  selectedEnvironmentId: string | null;
  showEnvironment: (id: string) => void;
}
interface SidebarListItemProps {
  environment: Environment;
  changeEnvironmentName: (environment: Environment, name?: string) => void;
  selectedEnvironmentId: string | null;
  showEnvironment: (id: string) => void;
}
const SidebarListItem: FC<SidebarListItemProps> = ({
  changeEnvironmentName,
  environment,
  selectedEnvironmentId,
  showEnvironment,
}: SidebarListItemProps) => {
  const workspaceMeta = useSelector(selectActiveWorkspaceMeta);

  return (<li
    key={environment._id}
    className={classnames({
      'env-modal__sidebar-item': true,
      'env-modal__sidebar-item--active': selectedEnvironmentId === environment._id,
      // Specify theme because dragging will pull it out to <body>
      'theme--dialog': true,
    })}
  >
    <button onClick={() => showEnvironment(environment._id)}>
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
      {environment._id === workspaceMeta?.activeEnvironmentId ? (
        <i className="fa fa-square active" title="Active Environment" />
      ) : (
        <button
          onClick={() => {
            if (environment && environment._id !== workspaceMeta?.activeEnvironmentId && workspaceMeta) {
              models.workspaceMeta.update(workspaceMeta, { activeEnvironmentId: environment._id });
              showEnvironment(environment._id);
            }
          }}
        >
          <i className="fa fa-square-o inactive" title="Click to activate Environment" />
        </button>
      )}
    </div>
  </li>);
};

const SidebarList: FC<SidebarListProps> =
  ({
    changeEnvironmentName,
    environments,
    selectedEnvironmentId,
    showEnvironment,
  }: SidebarListProps) => {
    return (
      <ul>
        {environments.map(environment =>
          (<SidebarListItem
            changeEnvironmentName={changeEnvironmentName}
            environment={environment}
            key={environment._id}
            selectedEnvironmentId={selectedEnvironmentId}
            showEnvironment={showEnvironment}
          />
          )
        )}
      </ul>);
  };
interface State {
  isValid: boolean;
  rootEnvironment: Environment | null;
  selectedEnvironmentId: string | null;
}
export interface WorkspaceEnvironmentsEditModalHandle {
  show: () => void;
  hide: () => void;
}
export const WorkspaceEnvironmentsEditModal = forwardRef<WorkspaceEnvironmentsEditModalHandle, ModalProps>((props, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const environmentEditorRef = useRef<EnvironmentEditorHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<State>({
    isValid: true,
    rootEnvironment: null,
    selectedEnvironmentId: null,
  });

  const workspace = useSelector(selectActiveWorkspace);
  const workspaceMeta = useSelector(selectActiveWorkspaceMeta);
  const environments = useSelector(selectEnvironments);
  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: async () => {
      if (!workspace) {
        return;
      }
      const rootEnvironment = await models.environment.getOrCreateForParentId(workspace._id);

      setState(state => ({
        ...state,
        rootEnvironment,
        selectedEnvironmentId: workspaceMeta?.activeEnvironmentId || rootEnvironment._id,
      }));
      modalRef.current?.show();
    },
  }), [workspace, workspaceMeta?.activeEnvironmentId]);

  function handleShowEnvironment(environmentId: string | null) {
    // Don't allow switching if the current one has errors
    if (environmentEditorRef.current?.isValid() && environmentId !== selectedEnvironmentId) {
      setState(state => ({
        ...state,
        selectedEnvironmentId: environmentId || null,
      }));
    }
  }

  async function handleDeleteEnvironment(environmentId: string | null) {
    // Don't delete the root environment
    if (!environmentId || environmentId === state.rootEnvironment?._id) {
      return;
    }
    // Unset active environment if it's being deleted
    if (workspaceMeta?.activeEnvironmentId === environmentId && workspaceMeta) {
      models.workspaceMeta.update(workspaceMeta, { activeEnvironmentId: null });
    }
    // Delete the current one
    const current = environments.find(e => e._id === environmentId);
    current && models.environment.remove(current);
    setState(state => ({
      ...state,
      selectedEnvironmentId: state.rootEnvironment?._id || null,
    }));
  }

  const updateEnvironment = async (environmentId: string | null, patch: Partial<Environment>) => {
    if (environmentId === null) {
      return;
    }
    // NOTE: Fetch the environment first because it might not be up to date.
    const realEnvironment = await models.environment.getById(environmentId);
    if (realEnvironment) {
      const updated = await models.environment.update(realEnvironment, patch);
      // reload the root environment if it changed since its not updated by redux
      const isRoot = realEnvironment?.parentId === workspace?._id;
      if (isRoot) {
        setState({ ...state, rootEnvironment: updated });
      }
    }
  };

  const { rootEnvironment, isValid, selectedEnvironmentId } = state;
  const selectedEnvironment = rootEnvironment?._id === selectedEnvironmentId
    ? rootEnvironment
    : environments.filter(e => e.parentId === rootEnvironment?._id).find(subEnvironment => subEnvironment._id === selectedEnvironmentId) || null;
  const selectedEnvironmentName = selectedEnvironment?.name || '';
  const selectedEnvironmentColor = selectedEnvironment?.color || null;
  if (inputRef.current && selectedEnvironmentColor) {
    inputRef.current.value = selectedEnvironmentColor;
  }
  return (
    <Modal ref={modalRef} wide tall {...props}>
      <ModalHeader>Manage Environments</ModalHeader>
      <ModalBody noScroll className="env-modal">
        <div className="env-modal__sidebar">
          <li
            className={classnames('env-modal__sidebar-root-item', {
              'env-modal__sidebar-item--active': selectedEnvironmentId === rootEnvironment?._id,
            })}
          >
            <button onClick={() => handleShowEnvironment(rootEnvironment?._id || null)}>
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
                  if (rootEnvironment) {
                    const environment = await models.environment.create({
                      parentId: rootEnvironment._id,
                      isPrivate: false,
                    });
                    setState(state => ({
                      ...state,
                      selectedEnvironmentId: environment._id,
                    }));
                  }
                }}
              >
                <i className="fa fa-eye" /> Environment
              </DropdownItem>
              <DropdownItem
                onClick={async () => {
                  if (rootEnvironment) {
                    const environment = await models.environment.create({
                      parentId: rootEnvironment._id,
                      isPrivate: true,
                    });
                    setState(state => ({
                      ...state,
                      selectedEnvironmentId: environment._id,
                    }));
                  }
                }}
                title="Environment will not be exported or synced"
              >
                <i className="fa fa-eye-slash" /> Private Environment
              </DropdownItem>
            </Dropdown>
          </div>
          <SidebarList
            environments={environments.filter(e => e.parentId === rootEnvironment?._id)}
            selectedEnvironmentId={selectedEnvironmentId}
            showEnvironment={handleShowEnvironment}
            changeEnvironmentName={(environment, name) => updateEnvironment(environment._id, { name })}
          />
        </div>
        <div className="env-modal__main">
          <div className="env-modal__main__header">
            <h1>
              {rootEnvironment?._id === selectedEnvironmentId ? (
                ROOT_ENVIRONMENT_NAME
              ) : (
                <Editable
                  singleClick
                  className="wide"
                  onSubmit={name => {
                    if (selectedEnvironmentId && name) {
                      updateEnvironment(selectedEnvironmentId, { name });
                    }
                  }}
                  value={selectedEnvironmentName}
                />
              )}
            </h1>

            {selectedEnvironmentId && rootEnvironment?._id !== selectedEnvironmentId ? (
              <Fragment>
                <input
                  className="hidden"
                  type="color"
                  ref={inputRef}
                  onChange={event => updateEnvironment(selectedEnvironmentId, { color: event.target.value })}
                />

                <Dropdown className="space-right" right>
                  <DropdownButton className="btn btn--clicky">
                    {selectedEnvironmentColor && (
                      <i
                        className="fa fa-circle space-right"
                        style={{
                          color: selectedEnvironmentColor,
                        }}
                      />
                    )}
                    Color <i className="fa fa-caret-down" />
                  </DropdownButton>

                  <DropdownItem
                    onClick={() => {
                      if (!selectedEnvironmentColor) {
                        // TODO: fix magic-number. Currently this is the `surprise` background color for the default theme,
                        // but we should be grabbing the actual value from the user's actual theme instead.
                        updateEnvironment(selectedEnvironmentId, { color: '#7d69cb' });
                      }
                      inputRef.current?.click();
                    }}
                  >
                    <i
                      className="fa fa-circle"
                      style={{
                        ...(selectedEnvironmentColor ? { color: selectedEnvironmentColor } : {}),
                      }}
                    />
                    {selectedEnvironmentColor ? 'Change Color' : 'Assign Color'}
                  </DropdownItem>

                  <DropdownItem
                    onClick={() => updateEnvironment(selectedEnvironmentId, { color: null })}
                    disabled={!selectedEnvironmentColor}
                  >
                    <i className="fa fa-minus-circle" />
                    Unset Color
                  </DropdownItem>
                </Dropdown>

                <button
                  onClick={async () => {
                    if (selectedEnvironment) {
                      const newEnvironment = await models.environment.duplicate(selectedEnvironment);
                      setState(state => ({
                        ...state,
                        selectedEnvironmentId: newEnvironment._id,
                      }));
                    }
                  }}
                  className="btn btn--clicky space-right"
                >
                  <i className="fa fa-copy" /> Duplicate
                </button>

                <PromptButton
                  onClick={() => handleDeleteEnvironment(selectedEnvironmentId)}
                  className="btn btn--clicky"
                >
                  <i className="fa fa-trash-o" />
                </PromptButton>
              </Fragment>
            ) : null}
          </div>
          <div className="env-modal__editor">
            <EnvironmentEditor
              ref={environmentEditorRef}
              key={`${selectedEnvironmentId || 'n/a'}`}
              environmentInfo={{
                object: selectedEnvironment?.data || {},
                propertyOrder: selectedEnvironment?.dataPropertyOrder || null,
              }}
              didChange={() => {
                const isValid = environmentEditorRef.current?.isValid() || false;
                if (state.isValid !== isValid) {
                  setState(state => ({
                    ...state,
                    isValid,
                  }));
                }
              }}
              onBlur={() => {
                // Only save if it's valid
                if (!environmentEditorRef.current || !environmentEditorRef.current?.isValid()) {
                  return;
                }
                const data = environmentEditorRef.current?.getValue();
                if (selectedEnvironment && data) {
                  updateEnvironment(selectedEnvironmentId, {
                    data: data.object,
                    dataPropertyOrder: data.propertyOrder,
                  });
                }
              }}
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

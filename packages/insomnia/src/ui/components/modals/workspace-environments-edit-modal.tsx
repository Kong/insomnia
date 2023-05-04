import classnames from 'classnames';
import React, { FC, forwardRef, Fragment, useImperativeHandle, useRef, useState } from 'react';
import { ListDropTargetDelegate, ListKeyboardDelegate, mergeProps, useDraggableCollection, useDraggableItem, useDropIndicator, useDroppableCollection, useDroppableItem, useFocusRing, useListBox, useOption } from 'react-aria';
import { useSelector } from 'react-redux';
import { Item, useDraggableCollectionState, useDroppableCollectionState, useListData, useListState } from 'react-stately';

import { docsTemplateTags } from '../../../common/documentation';
import * as models from '../../../models';
import type { Environment } from '../../../models/environment';
import { selectActiveWorkspace, selectActiveWorkspaceMeta, selectEnvironments } from '../../redux/selectors';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';
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

// @ts-expect-error props any
const DropIndicator = props => {
  const ref = React.useRef(null);
  const { dropIndicatorProps, isHidden, isDropTarget } =
    useDropIndicator(props, props.dropState, ref);
  if (isHidden) {
    return null;
  }

  return (
    <li
      {...dropIndicatorProps}
      role="option"
      ref={ref}
      style={{
        width: '100%',
        height: '2px',
        outline: 'none',
        marginBottom: '-2px',
        marginLeft: 0,
        background: isDropTarget ? 'var(--hl)' : '0 0',
      }}
    />
  );
};

const ReorderableOption = ({ item, state, dragState, dropState }): JSX.Element => {
  const ref = React.useRef(null);
  const { optionProps } = useOption({ key: item.key }, state, ref);
  const { isFocusVisible, focusProps } = useFocusRing();

  // Register the item as a drop target.
  const { dropProps, isDropTarget } = useDroppableItem(
    {
      target: { type: 'item', key: item.key, dropPosition: 'on' },
    },
    dropState,
    ref
  );
  // Register the item as a drag source.
  const { dragProps } = useDraggableItem({
    key: item.key,
  }, dragState);

  return (
    <>
      <DropIndicator
        target={{
          type: 'item',
          key: item.key,
          dropPosition: 'before',
        }}
        dropState={dropState}
      />
      <li
        {...mergeProps(
          optionProps,
          dragProps,
          dropProps,
          focusProps
        )}
        ref={ref}
        className={`option ${
          isFocusVisible ? 'focus-visible' : ''
        } ${isDropTarget ? 'drop-target' : ''}`}
      >
        {item.rendered}
      </li>
      {state.collection.getKeyAfter(item.key) == null &&
        (
          <DropIndicator
            target={{
              type: 'item',
              key: item.key,
              dropPosition: 'after',
            }}
            dropState={dropState}
          />
        )}
    </>
  );
};

// @ts-expect-error props any
const ReorderableListBox = props => {
  // See useListBox docs for more details.
  const state = useListState(props);
  const ref = React.useRef(null);
  const { listBoxProps } = useListBox(
    {
      ...props,
      shouldSelectOnPressUp: true,
    },
    state,
    ref
  );

  const dropState = useDroppableCollectionState({
    ...props,
    collection: state.collection,
    selectionManager: state.selectionManager,
  });

  const { collectionProps } = useDroppableCollection(
    {
      ...props,
      keyboardDelegate: new ListKeyboardDelegate(
        state.collection,
        state.disabledKeys,
        ref
      ),
      dropTargetDelegate: new ListDropTargetDelegate(
        state.collection,
        ref
      ),
    },
    dropState,
    ref
  );

  // Setup drag state for the collection.
  const dragState = useDraggableCollectionState({
    ...props,
    // Collection and selection manager come from list state.
    collection: state.collection,
    selectionManager: state.selectionManager,
    // Provide data for each dragged item. This function could
    // also be provided by the user of the component.
    getItems: props.getItems || (keys => {
      return [...keys].map(key => {
        const item = state.collection.getItem(key);

        return {
          'text/plain': item.textValue,
        };
      });
    }),
  });

  useDraggableCollection(props, dragState, ref);

  return (
    <ul
      {...mergeProps(listBoxProps, collectionProps)}
      ref={ref}
    >
      {[...state.collection].map(item => (
        <ReorderableOption
          key={item.key}
          item={item}
          state={state}
          dragState={dragState}
          dropState={dropState}
        />
      ))}
    </ul>
  );
};
interface State {
  baseEnvironment: Environment | null;
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
    baseEnvironment: null,
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
      const baseEnvironment = await models.environment.getOrCreateForParentId(workspace._id);

      setState(state => ({
        ...state,
        baseEnvironment,
        selectedEnvironmentId: workspaceMeta?.activeEnvironmentId || baseEnvironment._id,
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
    if (!environmentId || environmentId === state.baseEnvironment?._id) {
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
      selectedEnvironmentId: state.baseEnvironment?._id || null,
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
      const isBaseEnvironment = realEnvironment?.parentId === workspace?._id;
      if (isBaseEnvironment) {
        setState({ ...state, baseEnvironment: updated });
      }
    }
  };

  const { baseEnvironment, selectedEnvironmentId } = state;
  const selectedEnvironment = baseEnvironment?._id === selectedEnvironmentId
    ? baseEnvironment
    : environments.filter(e => e.parentId === baseEnvironment?._id).find(subEnvironment => subEnvironment._id === selectedEnvironmentId) || null;
  const selectedEnvironmentName = selectedEnvironment?.name || '';
  const selectedEnvironmentColor = selectedEnvironment?.color || null;
  const subEnvironments = environments
    .filter(environment => environment.parentId === (baseEnvironment && baseEnvironment._id))
    .sort((e1, e2) => e1.metaSortKey - e2.metaSortKey);
  if (inputRef.current && selectedEnvironmentColor) {
    inputRef.current.value = selectedEnvironmentColor;
  }

  function onReorder(e) {
    const reorderedEnv = subEnvironments.filter(evt => evt._id === [...e.keys][0])[0];
    const targetEnv = subEnvironments.filter(evt => evt._id === e.target.key)[0];
    const dropPosition = e.target.dropPosition;
    if (dropPosition === 'before') {
      reorderedEnv.metaSortKey = targetEnv.metaSortKey - 1;
    } else if (dropPosition === 'after') {
      reorderedEnv.metaSortKey = targetEnv.metaSortKey + 1;
    }
    console.log('reorderedEnv', reorderedEnv.metaSortKey, 'targetEnv', targetEnv.metaSortKey);
    updateEnvironment(reorderedEnv._id, { metaSortKey: reorderedEnv.metaSortKey });
  }

  return (
    <Modal ref={modalRef} wide tall {...props}>
      <ModalHeader>Manage Environments</ModalHeader>
      <ModalBody noScroll className="env-modal">
        <div className="env-modal__sidebar">
          <div
            className={classnames('env-modal__sidebar-root-item', {
              'env-modal__sidebar-item--active': selectedEnvironmentId === baseEnvironment?._id,
            })}
          >
            <button onClick={() => handleShowEnvironment(baseEnvironment?._id || null)}>
              {ROOT_ENVIRONMENT_NAME}
              <HelpTooltip className="space-left">
                The variables in this environment are always available, regardless of which
                sub-environment is active. Useful for storing default or fallback values.
              </HelpTooltip>
            </button>
          </div>
          <div className="pad env-modal__sidebar-heading">
            <h3 className="no-margin">Sub Environments</h3>
            <Dropdown
              aria-label='Create Environment Dropdown'
              triggerButton={
                <DropdownButton
                  data-testid='CreateEnvironmentDropdown'
                >
                  <i className="fa fa-plus-circle" />
                  <i className="fa fa-caret-down" />
                </DropdownButton>
              }
            >
              <DropdownItem aria-label='Environment'>
                <ItemContent
                  icon="eye"
                  label="Environment"
                  onClick={async () => {
                    if (baseEnvironment) {
                      const environment = await models.environment.create({
                        parentId: baseEnvironment._id,
                        isPrivate: false,
                      });
                      setState(state => ({
                        ...state,
                        selectedEnvironmentId: environment._id,
                      }));
                    }
                  }}
                />
              </DropdownItem>
              <DropdownItem aria-label='Private Environment'>
                <ItemContent
                  icon="eye-slash"
                  label="Private Environment"
                  onClick={async () => {
                    if (baseEnvironment) {
                      const environment = await models.environment.create({
                        parentId: baseEnvironment._id,
                        isPrivate: true,
                      });
                      setState(state => ({
                        ...state,
                        selectedEnvironmentId: environment._id,
                      }));
                    }
                  }}
                />
              </DropdownItem>
            </Dropdown>
          </div>
          {/* <SidebarList
            environments={environments.filter(e => e.parentId === baseEnvironment?._id)}
            selectedEnvironmentId={selectedEnvironmentId}
            showEnvironment={handleShowEnvironment}
            changeEnvironmentName={(environment, name) => updateEnvironment(environment._id, { name })}
          /> */}

          <ReorderableListBox items={subEnvironments} onReorder={onReorder} selectionMode="multiple" selectionBehavior="replace">
            {environment => <Item key={environment._id }>{environment.name}</Item>}
          </ReorderableListBox>
        </div>
        <div className="env-modal__main">
          <div className="env-modal__main__header">
            <h1>
              {baseEnvironment?._id === selectedEnvironmentId ? (
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

            {selectedEnvironmentId && baseEnvironment?._id !== selectedEnvironmentId ? (
              <Fragment>
                <input
                  className="hidden"
                  type="color"
                  ref={inputRef}
                  onChange={event => updateEnvironment(selectedEnvironmentId, { color: event.target.value })}
                />

                <Dropdown
                  aria-label='Environment Color Dropdown'
                  className="space-right"
                  triggerButton={
                    <DropdownButton
                      className="btn btn--clicky"
                      disableHoverBehavior={false}
                    >
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
                  }
                >
                  <DropdownItem aria-label={selectedEnvironmentColor ? 'Change Color' : 'Assign Color'}>
                    <ItemContent
                      icon="circle"
                      label={selectedEnvironmentColor ? 'Change Color' : 'Assign Color'}
                      iconStyle={{
                        ...(selectedEnvironmentColor ? { color: selectedEnvironmentColor } : {}),
                      }}
                      onClick={() => {
                        if (!selectedEnvironmentColor) {
                          // TODO: fix magic-number. Currently this is the `surprise` background color for the default theme,
                          // but we should be grabbing the actual value from the user's actual theme instead.
                          updateEnvironment(selectedEnvironmentId, { color: '#7d69cb' });
                        }
                        inputRef.current?.click();
                      }}
                    />
                  </DropdownItem>

                  <DropdownItem aria-label='Unset Color'>
                    <ItemContent
                      isDisabled={!selectedEnvironmentColor}
                      icon="minus-circle"
                      label="Unset Color"
                      onClick={() => updateEnvironment(selectedEnvironmentId, { color: null })}
                    />
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
        <button className="btn" onClick={() => modalRef.current?.hide()}>
          Close
        </button>
      </ModalFooter>
    </Modal>
  );
});
WorkspaceEnvironmentsEditModal.displayName = 'WorkspaceEnvironmentsEditModal';

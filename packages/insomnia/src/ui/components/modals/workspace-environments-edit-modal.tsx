import classnames from 'classnames';
import React, { FC, Fragment, useEffect, useRef } from 'react';
import { ListDropTargetDelegate, ListKeyboardDelegate, mergeProps, OverlayContainer, useDraggableCollection, useDraggableItem, useDropIndicator, useDroppableCollection, useDroppableItem, useFocusRing, useListBox, useOption } from 'react-aria';
import { useFetcher, useParams, useRouteLoaderData } from 'react-router-dom';
import { DraggableCollectionState, DroppableCollectionState, Item, ListState, useDraggableCollectionState, useDroppableCollectionState, useListState } from 'react-stately';

import { docsTemplateTags } from '../../../common/documentation';
import type { Environment } from '../../../models/environment';
import { WorkspaceLoaderData } from '../../routes/workspace';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from '../base/dropdown';
import { Editable } from '../base/editable';
import { Link } from '../base/link';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { PromptButton } from '../base/prompt-button';
import { EnvironmentEditor, EnvironmentEditorHandle } from '../editors/environment-editor';
import { HelpTooltip } from '../help-tooltip';
import { Tooltip } from '../tooltip';

const ROOT_ENVIRONMENT_NAME = 'Base Environment';

interface SidebarListItemProps {
  environment: Environment;
}

const SidebarListItem: FC<SidebarListItemProps> = ({
  environment,
}: SidebarListItemProps) => {
  const {
    activeWorkspaceMeta,
  } = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData;
  return (
    <div
      className={classnames({
        'env-modal__sidebar-item': true,
        'env-modal__sidebar-item--active': activeWorkspaceMeta.activeEnvironmentId === environment._id,
      })}
    >
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
      <>{environment.name}</>
    </div>);
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

// @ts-expect-error Node not generic?
const ReorderableOption = ({ item, state, dragState, dropState }: { item: Node<Environment>; state: ListState<Node<Environment>>; dragState: DraggableCollectionState; dropState: DroppableCollectionState }): JSX.Element => {
  const ref = React.useRef(null);
  const { optionProps } = useOption({ key: item.key }, state, ref);
  const { focusProps } = useFocusRing();

  // Register the item as a drop target.
  const { dropProps } = useDroppableItem(
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

  const environment = item.value as unknown as Environment;

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
        style={{
          gap: '1rem',
          display: 'flex',
          padding: '5px',
          outlineStyle: 'none',
        }}
        {...mergeProps(
          optionProps,
          dragProps,
          dropProps,
          focusProps
        )}
        ref={ref}
        className={classnames({
          'env-modal__sidebar-item': true,
        })}
      >
        <SidebarListItem environment={environment} />
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
          'text/plain': item?.textValue,
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

export const WorkspaceEnvironmentsEditModal = (props: ModalProps) => {
  const { organizationId, projectId, workspaceId } = useParams<{ organizationId: string; projectId: string; workspaceId: string }>();
  const routeData = useRouteLoaderData(
    ':workspaceId'
  ) as WorkspaceLoaderData;
  const modalRef = useRef<ModalHandle>(null);
  const environmentEditorRef = useRef<EnvironmentEditorHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const createEnvironmentFetcher = useFetcher();
  const deleteEnvironmentFetcher = useFetcher();
  const updateEnvironmentFetcher = useFetcher();
  const setActiveEnvironmentFetcher = useFetcher();
  const duplicateEnvironmentFetcher = useFetcher();
  useEffect(() => {
    modalRef.current?.show();
  }, []);

  if (!routeData) {
    return null;
  }

  const {
    baseEnvironment,
    activeWorkspaceMeta,
    activeEnvironment,
    subEnvironments,
  } = routeData;

  function onSelectionChange(e: any) {
    const environmentId = e.anchorKey;
    // Only switch if valid
    if (environmentEditorRef.current?.isValid() && activeWorkspaceMeta?.activeEnvironmentId !== environmentId) {
      setActiveEnvironmentFetcher.submit({
        environmentId,
      },
        {
          method: 'post',
          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/set-active`,
        });
    }
  }

  async function handleDeleteEnvironment(environmentId: string) {
    deleteEnvironmentFetcher.submit({
      environmentId,
    },
      {
        method: 'post',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/delete`,
      });
  }

  const updateEnvironment = async (environmentId: string, patch: Partial<Environment>) => {
    updateEnvironmentFetcher.submit({
      patch,
      environmentId,
    },
      {
        encType: 'application/json',
        method: 'post',
        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/update`,
      });
  };

  function onReorder(e: any) {
    const source = [...e.keys][0];
    const sourceEnv = subEnvironments.find(evt => evt._id === source);
    const targetEnv = subEnvironments.find(evt => evt._id === e.target.key);
    if (!sourceEnv || !targetEnv) {
      return;
    }
    const dropPosition = e.target.dropPosition;
    if (dropPosition === 'before') {
      sourceEnv.metaSortKey = targetEnv.metaSortKey - 1;
    }
    if (dropPosition === 'after') {
      sourceEnv.metaSortKey = targetEnv.metaSortKey + 1;
    }
    updateEnvironment(sourceEnv._id, { metaSortKey: sourceEnv.metaSortKey });
  }

  return (
    <OverlayContainer>
      <Modal ref={modalRef} wide tall onHide={props.onHide}>
        <ModalHeader>Manage Environments</ModalHeader>
        <ModalBody noScroll className="env-modal">
          <div className="env-modal__sidebar">
            <div
              className={classnames('env-modal__sidebar-root-item', {
                'env-modal__sidebar-item--active': activeEnvironment._id === baseEnvironment._id,
              })}
            >
              <button
                onClick={() => {
                  if (environmentEditorRef.current?.isValid() && activeEnvironment._id !== baseEnvironment._id) {
                    setActiveEnvironmentFetcher.submit({
                      environmentId: baseEnvironment._id,
                    },
                      {
                        method: 'post',
                        action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/set-active`,
                      });
                  }
                }}
              >
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
                    icon="refresh"
                    label="Shared Environment"
                    onClick={async () => {
                      createEnvironmentFetcher.submit({
                        isPrivate: false,
                      },
                        {
                          encType: 'application/json',
                          method: 'post',
                          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/create`,
                        });
                    }}
                  />
                </DropdownItem>
                <DropdownItem aria-label='Private Environment'>
                  <ItemContent
                    icon="lock"
                    label="Private Environment"
                    onClick={async () => {
                      createEnvironmentFetcher.submit({
                        isPrivate: true,
                      },
                        {
                          encType: 'application/json',
                          method: 'post',
                          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/create`,
                        });
                    }}
                  />
                </DropdownItem>
              </Dropdown>
            </div>
            <ReorderableListBox
              items={subEnvironments}
              onSelectionChange={onSelectionChange}
              onReorder={onReorder}
              selectionMode="multiple"
              selectionBehavior="replace"
              aria-label="list of subenvironments"
            >
              {(environment: any) =>
                <Item key={environment._id}>
                  {environment.name}
                </Item>
              }
            </ReorderableListBox>
          </div>
          <div className="env-modal__main">
            <div className="env-modal__main__header">
              <h1>
                {baseEnvironment._id === activeEnvironment._id ? (
                  ROOT_ENVIRONMENT_NAME
                ) : (
                  <Editable
                    singleClick
                    className="wide"
                    onSubmit={name => {
                      if (activeEnvironment._id && name) {
                        updateEnvironment(activeEnvironment._id, { name });
                      }
                    }}
                    value={activeEnvironment.name}
                  />
                )}
              </h1>

              {baseEnvironment._id !== activeEnvironment._id ? (
                <Fragment>
                  <input
                    className="hidden"
                    type="color"
                    ref={inputRef}
                    onChange={event => updateEnvironment(activeEnvironment._id, { color: event.target.value })}
                  />

                  <Dropdown
                    aria-label='Environment Color Dropdown'
                    className="space-right"
                    triggerButton={
                      <DropdownButton
                        className="btn btn--clicky"
                        disableHoverBehavior={false}
                      >
                        {activeEnvironment.color && (
                          <i
                            className="fa fa-circle space-right"
                            style={{
                              color: activeEnvironment.color,
                            }}
                          />
                        )}
                        Color <i className="fa fa-caret-down" />
                      </DropdownButton>
                    }
                  >
                    <DropdownItem aria-label={activeEnvironment.color ? 'Change Color' : 'Assign Color'}>
                      <ItemContent
                        icon="circle"
                        label={activeEnvironment.color ? 'Change Color' : 'Assign Color'}
                        iconStyle={{
                          ...(activeEnvironment.color ? { color: activeEnvironment.color } : {}),
                        }}
                        onClick={() => {
                          if (!activeEnvironment.color) {
                            // TODO: fix magic-number. Currently this is the `surprise` background color for the default theme,
                            // but we should be grabbing the actual value from the user's actual theme instead.
                            updateEnvironment(activeEnvironment._id, { color: '#7d69cb' });
                          }
                          inputRef.current?.click();
                        }}
                      />
                    </DropdownItem>

                    <DropdownItem aria-label='Unset Color'>
                      <ItemContent
                        isDisabled={!activeEnvironment.color}
                        icon="minus-circle"
                        label="Unset Color"
                        onClick={() => updateEnvironment(activeEnvironment._id, { color: null })}
                      />
                    </DropdownItem>
                  </Dropdown>

                  <button
                    onClick={async () => {
                      if (activeEnvironment) {
                        duplicateEnvironmentFetcher.submit({
                          environmentId: activeEnvironment._id,
                        }, {
                          method: 'post',
                          action: `/organization/${organizationId}/project/${projectId}/workspace/${workspaceId}/environment/duplicate`,
                        });
                      }
                    }}
                    className="btn btn--clicky space-right"
                  >
                    <i className="fa fa-copy" /> Duplicate
                  </button>

                  {activeEnvironment._id !== baseEnvironment._id && <PromptButton
                    onClick={() => handleDeleteEnvironment(activeEnvironment._id)}
                    className="btn btn--clicky"
                  >
                    <i className="fa fa-trash-o" />
                  </PromptButton>}
                </Fragment>
              ) : null}
            </div>
            <div className="env-modal__editor">
              <EnvironmentEditor
                ref={environmentEditorRef}
                key={`${activeEnvironment._id}`}
                environmentInfo={{
                  object: activeEnvironment.data,
                  propertyOrder: activeEnvironment.dataPropertyOrder,
                }}
                onBlur={() => {
                  // Only save if it's valid
                  if (!environmentEditorRef.current || !environmentEditorRef.current?.isValid()) {
                    return;
                  }
                  const data = environmentEditorRef.current?.getValue();
                  if (activeEnvironment && data) {
                    updateEnvironment(activeEnvironment._id, {
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
    </OverlayContainer>
  );
};

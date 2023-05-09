import classnames from 'classnames';
import React, { FC, Fragment } from 'react';
import { ListDropTargetDelegate, ListKeyboardDelegate, mergeProps, useDraggableCollection, useDraggableItem, useDropIndicator, useDroppableCollection, useDroppableItem, useFocusRing, useListBox, useOption } from 'react-aria';
import ReactDOM from 'react-dom';
import { useSelector } from 'react-redux';
import { Item, useDraggableCollectionState, useDroppableCollectionState, useListState } from 'react-stately';

import { GrpcRequest } from '../../../models/grpc-request';
import { update } from '../../../models/helpers/request-operations';
import { Request } from '../../../models/request';
import { isRequestGroup, RequestGroup } from '../../../models/request-group';
import { WebSocketRequest } from '../../../models/websocket-request';
import { selectActiveRequest } from '../../redux/selectors';
import { selectSidebarChildren } from '../../redux/sidebar-selectors';
import { SidebarCreateDropdown } from './sidebar-create-dropdown';
import { SidebarRequestGroupRow } from './sidebar-request-group-row';
import { SidebarRequestRow } from './sidebar-request-row';

// TODO
// rename the child type to sometihng less collision-y
// decide the best way to pass filters down the tree

export interface Child {
  doc: Request | GrpcRequest | WebSocketRequest | RequestGroup;
  children: Child[];
  collapsed: boolean;
  hidden: boolean;
  pinned: boolean;
}
export interface SidebarChildObjects {
  pinned: Child[];
  all: Child[];
}

function hasActiveChild(children: Child[], activeRequestId: string): boolean {
  return !!children.find(c => c.doc._id === activeRequestId || hasActiveChild(c.children || [], activeRequestId));
}

interface Props {
  filter: string;
}
export const SidebarChildren: FC<Props> = ({
  filter,
}) => {
  const sidebarChildren = useSelector(selectSidebarChildren);

  const { all, pinned } = sidebarChildren;
  const showSeparator = sidebarChildren.pinned.length > 0;
  const contextMenuPortal = ReactDOM.createPortal(
    <div className="hide">
      <SidebarCreateDropdown />
    </div>,
    document.querySelector('#dropdowns-container') as any
  );
  return (
    <Fragment>
      <ul className="sidebar__list sidebar__list-root theme--sidebar__list">
        <RecursiveSidebarRows
          filter={filter}
          isInPinnedList={true}
          rows={pinned}
        />
      </ul>
      <div
        className={`sidebar__list-separator${showSeparator ? '' : '--invisible'
          }`}
      />
      <ul className="sidebar__list sidebar__list-root theme--sidebar__list">
        <RecursiveSidebarRows
          filter={filter}
          isInPinnedList={false}
          rows={all}
        />
      </ul>
      {contextMenuPortal}
    </Fragment>
  );
};

interface RecursiveSidebarRowsProps {
  rows: Child[];
  isInPinnedList: boolean;
  filter: string;
}

const RecursiveSidebarRows = ({
  rows,
  isInPinnedList,
  filter,
}: RecursiveSidebarRowsProps) => {
  const activeRequest = useSelector(selectActiveRequest);
  const activeRequestId = activeRequest ? activeRequest._id : 'n/a';
  return (<ReorderableListBox
    items={rows}
    onSelectionChange={e => {
      console.log(e);
    }}
    onReorder={e => {
      const source = [...e.keys][0];
      const sourceRow = rows.find(evt => evt.doc._id === source);
      const targetRow = rows.find(evt => evt.doc._id === e.target.key);
      if (!sourceRow || !targetRow) {
        return;
      }
      const dropPosition: 'before' | 'after' = e.target.dropPosition;

      const position = {
        'before': -1,
        'after': 1,
      };
      console.log('onReorder', targetRow.doc.metaSortKey, position[dropPosition]);

      // TODO: reassign parentId here if target is folder
      update(sourceRow.doc, { metaSortKey: targetRow.doc.metaSortKey + position[dropPosition] });
    }}
    onAction={e => {
      console.log('onAction', e);
    }}
    selectionMode="multiple"
    selectionBehavior="replace"
    aria-label="tree of requests"
  >
    {(item: any) =>
      <Item key={item.doc._id}>
        {item.name}
      </Item>
    }
  </ReorderableListBox>);
  // return (
  //   <>
  //     {rows
  //       .filter(row => !(!isInPinnedList && row.hidden))
  //       .map(row => {
  //         if (isRequestGroup(row.doc)) {
  //           return (
  //             <SidebarRequestGroupRow
  //               key={row.doc._id}
  //               filter={filter || ''}
  //               isActive={hasActiveChild(row.children, activeRequestId)}
  //               isCollapsed={row.collapsed}
  //               requestGroup={row.doc}
  //             >
  //               {row.children.filter(Boolean).length > 0 ? (
  //                 <RecursiveSidebarRows
  //                   isInPinnedList={isInPinnedList}
  //                   rows={row.children}
  //                   filter={filter}
  //                 />
  //               ) : null}
  //             </SidebarRequestGroupRow>
  //           );
  //         }
  //         return (
  //           <SidebarRequestRow
  //             key={row.doc._id}
  //             filter={isInPinnedList ? '' : filter || ''}
  //             isActive={row.doc._id === activeRequestId}
  //             isPinned={row.pinned}
  //             disableDragAndDrop={isInPinnedList}
  //             request={row.doc}
  //           />
  //         );
  //       })}
  //   </>
  // );
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

// @ts-expect-error Node not generic?
const ReorderableOption = ({ item, state, dragState, dropState }: { item: Node<Child>; state: ListState<Node<Child>>; dragState: DraggableCollectionState; dropState: DroppableCollectionState }): JSX.Element => {
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

  const row = item.value as unknown as Child;
  const filter = '';// TODO
  const activeRequestId = '';// TODO
  const isInPinnedList = false;
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
        {isRequestGroup(row.doc) ?
          (
            <SidebarRequestGroupRow
              key={row.doc._id}
              filter={filter || ''}
              isActive={hasActiveChild(row.children, activeRequestId)}
              isCollapsed={row.collapsed}
              requestGroup={row.doc}
            >
              {row.children.filter(Boolean).length > 0 ? (
                <RecursiveSidebarRows
                  isInPinnedList={isInPinnedList}
                  rows={row.children}
                  filter={filter}
                />
              ) : null}
            </SidebarRequestGroupRow>)
          : (
            <SidebarRequestRow
              key={row.doc._id}
              filter={isInPinnedList ? '' : filter || ''}
              isActive={row.doc._id === activeRequestId}
              isPinned={row.pinned}
              disableDragAndDrop={isInPinnedList}
              request={row.doc}
            />)}
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

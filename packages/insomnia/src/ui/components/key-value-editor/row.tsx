// eslint-disable-next-line filenames/match-exported
import classnames from 'classnames';
import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ConnectDragPreview, ConnectDragSource, ConnectDropTarget, DragSource, DropTarget, DropTargetMonitor } from 'react-dnd';
import ReactDOM from 'react-dom';

import { describeByteSize } from '../../../common/misc';
import { useNunjucksEnabled } from '../../context/nunjucks/nunjucks-enabled-context';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { FileInputButton } from '../base/file-input-button';
import { PromptButton } from '../base/prompt-button';
import { OneLineEditor, OneLineEditorHandle } from '../codemirror/one-line-editor';
import { CodePromptModal } from '../modals/code-prompt-modal';
import { showModal } from '../modals/index';

export interface Pair {
  id?: string;
  name: string;
  value: string;
  description?: string;
  fileName?: string;
  type?: string;
  disabled?: boolean;
  multiline?: boolean | string;
}

export type AutocompleteHandler = (pair: Pair) => string[] | PromiseLike<string[]>;

type DragDirection = 0 | 1 | -1;

interface Props {
  allowFile?: boolean;
  allowMultiline?: boolean;
  className?: string;
  connectDragPreview?: ConnectDragPreview;
  connectDragSource?: ConnectDragSource;
  connectDropTarget?: ConnectDropTarget;
  descriptionPlaceholder?: string;
  displayDescription: boolean;
  forceInput?: boolean;
  handleGetAutocompleteNameConstants?: AutocompleteHandler;
  handleGetAutocompleteValueConstants?: AutocompleteHandler;
  hideButtons?: boolean;
  isDragging?: boolean;
  isDraggingOver?: boolean;
  namePlaceholder?: string;
  noDelete?: boolean;
  noDropZone?: boolean;
  onBlurDescription?: (pair: Pair, event: FocusEvent | React.FocusEvent<Element, Element>) => void;
  onBlurName?: (pair: Pair, event: FocusEvent | React.FocusEvent<Element, Element>) => void;
  onBlurValue?: (pair: Pair, event: FocusEvent | React.FocusEvent<Element, Element>) => void;
  onChange?: (pair: Pair) => void;
  onDelete?: (pair: Pair) => void;
  onFocusDescription?: (pair: Pair, event: FocusEvent | React.FocusEvent<Element, Element>) => void;
  onFocusName?: (pair: Pair, event: FocusEvent | React.FocusEvent<Element, Element>) => void;
  onFocusValue?: (pair: Pair, event: FocusEvent | React.FocusEvent<Element, Element>) => void;
  onKeyDown?: (pair: Pair, event: KeyboardEvent | React.KeyboardEvent<Element>, value?: any) => void;
  pair: Pair;
  readOnly?: boolean;
  renderLeftIcon?: Function;
  sortable?: boolean;
  valueInputType?: string;
  valuePlaceholder?: string;
}
interface DnDProps extends Props {
  onMove?: (pairToMove: Pair, pairToTarget: Pair, targetOffset: 1 | -1) => void;
  index: number;
}

export interface RowHandle {
  focusNameEnd: () => void;
  focusValueEnd: () => void;
  focusDescriptionEnd: () => void;
  setDragDirection: (dragDirection: DragDirection) => void;
}
const RowFC = forwardRef<RowHandle, Props>(({
  allowFile,
  allowMultiline,
  className,
  connectDragPreview,
  connectDragSource,
  connectDropTarget,
  descriptionPlaceholder,
  displayDescription,
  forceInput,
  handleGetAutocompleteNameConstants,
  handleGetAutocompleteValueConstants,
  hideButtons,
  isDragging,
  isDraggingOver,
  namePlaceholder,
  noDelete,
  noDropZone,
  onBlurDescription,
  onBlurName,
  onBlurValue,
  onChange,
  onDelete,
  onFocusDescription,
  onFocusName,
  onFocusValue,
  onKeyDown,
  pair,
  readOnly,
  renderLeftIcon,
  sortable,
  valueInputType,
  valuePlaceholder,
}, ref) => {

  const { enabled } = useNunjucksEnabled();

  const nameRef = useRef<OneLineEditorHandle>(null);
  const valueRef = useRef<OneLineEditorHandle>(null);
  const descriptionRef = useRef<OneLineEditorHandle>(null);
  const [dragDirection, setDragDirection] = useState<DragDirection>(0);

  useImperativeHandle(ref, () => ({
    focusNameEnd: () => nameRef.current?.focusEnd(),
    focusValueEnd: () => valueRef.current?.focusEnd(),
    focusDescriptionEnd: () => descriptionRef.current?.focusEnd(),
    setDragDirection,
  }));

  function _handleTypeChange(def: Partial<Pair>) {
    // Remove newlines if converting to text
    // WARNING: props should never be overwritten!
    let value = pair.value || '';
    if (def.type === 'text' && !def.multiline && value.includes('\n')) {
      value = value.replace(/\n/g, '');
    }
    onChange?.(Object.assign({}, pair, { type: def.type, multiline: def.multiline, value }));
  }
  const classes = classnames(className, {
    'key-value-editor__row-wrapper': true,
    'key-value-editor__row-wrapper--dragging': isDragging,
    'key-value-editor__row-wrapper--dragging-above': isDraggingOver && dragDirection > 0,
    'key-value-editor__row-wrapper--dragging-below': isDraggingOver && dragDirection < 0,
    'key-value-editor__row-wrapper--disabled': pair.disabled,
  });

  const showDropdown = allowMultiline || allowFile;
  let renderPairSelector;
  // Put a spacer in for dropdown if needed
  if (hideButtons && showDropdown) {
    renderPairSelector = (
      <button>
        <i className="fa fa-empty" />
      </button>
    );
  } else if (hideButtons) {
    renderPairSelector = null;
  } else {
    renderPairSelector = showDropdown ? (
      <Dropdown right>
        <DropdownButton className="tall">
          <i className="fa fa-caret-down" />
        </DropdownButton>
        <DropdownItem
          onClick={() => _handleTypeChange({
            type: 'text',
            multiline: false,
          })}
        >
          Text
        </DropdownItem>
        {allowMultiline && (
          <DropdownItem
            onClick={() => _handleTypeChange({
              type: 'text',
              multiline: true,
            })}
          >
            Text (Multi-line)
          </DropdownItem>
        )}
        {allowFile && (
          <DropdownItem
            onClick={() => _handleTypeChange({
              type: 'file',
            })}
          >
            File
          </DropdownItem>
        )}
      </Dropdown>
    ) : null;
  }

  let pairValue;
  if (pair.type === 'file') {
    pairValue = (
      <FileInputButton
        showFileName
        showFileIcon
        className="btn btn--outlined btn--super-duper-compact wide ellipsis"
        path={pair.fileName || ''}
        onChange={filename => onChange?.(Object.assign({}, pair, { filename }))}
      />
    );
  } else if (pair.type === 'text' && pair.multiline) {
    const bytes = Buffer.from(pair.value, 'utf8').length;
    pairValue = (
      <button
        className="btn btn--outlined btn--super-duper-compact wide ellipsis"
        onClick={() => showModal(CodePromptModal, {
          submitName: 'Done',
          title: `Edit ${pair.name}`,
          defaultValue: pair.value,
          onChange: (value: string) => onChange?.(Object.assign({}, pair, { value })),
          enableRender: enabled,
          mode: pair.multiline || 'text/plain',
          onModeChange: (mode: string) => _handleTypeChange(Object.assign({}, pair, { multiline: mode })),
        })}
      >
        <i className="fa fa-pencil-square-o space-right" />
        {bytes > 0 ? describeByteSize(bytes, true) : 'Click to Edit'}
      </button>
    );
  } else {
    pairValue = (
      <OneLineEditor
        ref={valueRef}
        readOnly={readOnly}
        forceInput={forceInput}
        type={valueInputType || 'text'}
        placeholder={valuePlaceholder || 'Value'}
        defaultValue={pair.value}
        onPaste={event => {
          if (!allowMultiline) {
            return;
          }
          const value = event.clipboardData?.getData('text/plain');
          if (value?.includes('\n')) {
            event.preventDefault();
            // Insert the pasted text into the current selection.
            // Unfortunately, this is the easiest way to do
            const currentValue = valueRef.current?.getValue();
            const start = valueRef.current?.getSelectionStart() || 0;
            const end = valueRef.current?.getSelectionEnd() || 0;
            const prefix = currentValue?.slice(0, start);
            const suffix = currentValue?.slice(end);
            const finalValue = `${prefix}${value}${suffix}`;
            // Update type and value
            _handleTypeChange({
              type: 'text',
              multiline: 'text/plain',
            });
            onChange?.(Object.assign({}, pair, { value: finalValue }));
          }
        }}
        onChange={value => onChange?.(Object.assign({}, pair, { value }))}
        onBlur={event => onBlurValue?.(pair, event)}
        onKeyDown={(event, value) => onKeyDown?.(pair, event, value)}
        onFocus={event => onFocusValue?.(pair, event)}
        getAutocompleteConstants={() => handleGetAutocompleteValueConstants?.(pair) || []}
      />
    );
  }

  let handle: ConnectDragSource | JSX.Element | undefined | null = null;

  if (sortable) {
    handle = renderLeftIcon ? (
      <div className="key-value-editor__drag">{renderLeftIcon()}</div>
    ) : (
      connectDragSource?.(
        <div className="key-value-editor__drag">
          <i className={'fa ' + (hideButtons ? 'fa-empty' : 'fa-reorder')} />
        </div>,
      )
    );
  }

  const row = (
    <li className={classes}>
      {handle}
      <div className="key-value-editor__row">
        <div
          className={classnames('form-control form-control--underlined form-control--wide', {
            'form-control--inactive': pair.disabled,
          })}
        >
          <OneLineEditor
            ref={nameRef}
            placeholder={namePlaceholder || 'Name'}
            defaultValue={pair.name}
            getAutocompleteConstants={() => handleGetAutocompleteNameConstants?.(pair) || []}
            forceInput={forceInput}
            readOnly={readOnly}
            onBlur={event => onBlurName?.(pair, event)}
            onChange={name => onChange?.(Object.assign({}, pair, { name }))}
            onFocus={event => onFocusName?.(pair, event)}
            onKeyDown={(event, value) => onKeyDown?.(pair, event, value)}
          />
        </div>
        <div
          className={classnames('form-control form-control--underlined form-control--wide', {
            'form-control--inactive': pair.disabled,
          })}
        >
          {pairValue}
        </div>
        {displayDescription ? (
          <div
            className={classnames(
              'form-control form-control--underlined form-control--wide no-min-width',
              {
                'form-control--inactive': pair.disabled,
              },
            )}
          >
            <OneLineEditor
              ref={descriptionRef}
              readOnly={readOnly}
              forceInput={forceInput}
              placeholder={descriptionPlaceholder || 'Description'}
              defaultValue={pair.description || ''}
              onChange={description => onChange?.(Object.assign({}, pair, { description }))}
              onBlur={event => onBlurDescription?.(pair, event)}
              onKeyDown={(event, value) => onKeyDown?.(pair, event, value)}
              onFocus={event => onFocusDescription?.(pair, event)}
            />
          </div>
        ) : null}

        {renderPairSelector}

        {!hideButtons ? (
          <button
            onClick={() => onChange?.(Object.assign({}, pair, { disabled: !pair.disabled }))}
            title={pair.disabled ? 'Enable item' : 'Disable item'}
          >
            {pair.disabled ? (
              <i className="fa fa-square-o" />
            ) : (
              <i className="fa fa-check-square-o" />
            )}
          </button>
        ) : (
          <button>
            <i className="fa fa-empty" />
          </button>
        )}

        {!noDelete &&
          (!hideButtons ? (
            <PromptButton
              key={Math.random()}
              tabIndex={-1}
              confirmMessage=""
              onClick={() => onDelete?.(pair)}
              title="Delete item"
            >
              <i className="fa fa-trash-o" />
            </PromptButton>
          ) : (
            <button>
              <i className="fa fa-empty" />
            </button>
          ))}
      </div>
    </li>
  );
  const isConnected = connectDragPreview && connectDropTarget;
  if (!isConnected) {
    return row;
  }
  return Boolean(noDropZone) ? row : connectDragPreview(connectDropTarget(row));
});
RowFC.displayName = 'RowFC';

const dragSource = {
  beginDrag(props: Props) {
    return {
      pair: props.pair,
    };
  },
};

function isAbove(monitor: DropTargetMonitor, component: any) {
  const hoveredNode = ReactDOM.findDOMNode(component);
  // @ts-expect-error -- TSCONVERSION
  const hoveredTop = hoveredNode.getBoundingClientRect().top;
  // @ts-expect-error -- TSCONVERSION
  const height = hoveredNode.clientHeight;
  const draggedTop = monitor.getSourceClientOffset()?.y;
  // NOTE: Not quite sure why it's height / 3 (seems to work)
  return draggedTop !== undefined ? hoveredTop > draggedTop - height / 3 : false;
}

const dragTarget = {
  drop(props: DnDProps, monitor: DropTargetMonitor, component: any) {
    if (isAbove(monitor, component)) {
      props.onMove?.(monitor.getItem().pair, props.pair, 1);
    } else {
      props.onMove?.(monitor.getItem().pair, props.pair, -1);
    }
  },

  hover(_props: Props, monitor: DropTargetMonitor, component: any) {
    if (isAbove(monitor, component)) {
      component.setDragDirection(1);
    } else {
      component.setDragDirection(-1);
    }
  },
};

const source = DragSource('KEY_VALUE_EDITOR', dragSource, (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  connectDragPreview: connect.dragPreview(),
  isDragging: monitor.isDragging(),
}))(RowFC);

export const Row = DropTarget('KEY_VALUE_EDITOR', dragTarget, (connect, monitor) => ({
  connectDropTarget: connect.dropTarget(),
  isDraggingOver: monitor.isOver(),
}))(source);

Row.prototype.focusNameEnd = function() {
  decoratedRef.current.decoratedRef.current.focusNameEnd();
};

Row.prototype.focusValueEnd = function() {
  decoratedRef.current.decoratedRef.current.focusValueEnd();
};

Row.prototype.focusDescriptionEnd = function() {
  decoratedRef.current.decoratedRef.current.focusDescriptionEnd();
};

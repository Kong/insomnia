// eslint-disable-next-line filenames/match-exported
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { forwardRef, ForwardRefRenderFunction, PureComponent } from 'react';
import { ConnectDragPreview, ConnectDragSource, ConnectDropTarget, DragSource, DropTarget, DropTargetMonitor } from 'react-dnd';
import ReactDOM from 'react-dom';

import { AUTOBIND_CFG } from '../../../common/constants';
import { describeByteSize } from '../../../common/misc';
import { useNunjucksEnabled } from '../../context/nunjucks/nunjucks-enabled-context';
import { Button } from '../base/button';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import { FileInputButton } from '../base/file-input-button';
import { PromptButton } from '../base/prompt-button';
import { OneLineEditor } from '../codemirror/one-line-editor';
import { CodePromptModal } from '../modals/code-prompt-modal';
import { showModal } from '../modals/index';

export interface Pair {
  id: string;
  name: string;
  value: string;
  description: string;
  fileName?: string;
  type?: string;
  disabled?: boolean;
  multiline?: boolean | string;
}

export type AutocompleteHandler = (pair: Pair) => string[] | PromiseLike<string[]>;

type DragDirection = 0 | 1 | -1;

interface Props {
  onChange: (pair: Pair) => void;
  onDelete: (pair: Pair) => void;
  onFocusName: (pair: Pair, event: FocusEvent) => void;
  onFocusValue: (pair: Pair, event: FocusEvent) => void;
  onFocusDescription: (pair: Pair, event: FocusEvent) => void;
  displayDescription: boolean;
  index: number;
  pair: Pair;
  readOnly?: boolean;
  onMove?: (pairToMove: Pair, pairToTarget: Pair, targetOffset: 1 | -1) => void;
  onKeyDown?: (pair: Pair, event: KeyboardEvent, value?: any) => void;
  onBlurName?: (pair: Pair, event: FocusEvent) => void;
  onBlurValue?: (pair: Pair, event: FocusEvent) => void;
  onBlurDescription?: (pair: Pair, event: FocusEvent) => void;
  enableNunjucks?: boolean;
  handleGetAutocompleteNameConstants?: AutocompleteHandler;
  handleGetAutocompleteValueConstants?: AutocompleteHandler;
  namePlaceholder?: string;
  valuePlaceholder?: string;
  descriptionPlaceholder?: string;
  valueInputType?: string;
  forceInput?: boolean;
  allowMultiline?: boolean;
  allowFile?: boolean;
  sortable?: boolean;
  noDelete?: boolean;
  noDropZone?: boolean;
  hideButtons?: boolean;
  className?: string;
  renderLeftIcon?: Function;
  // For drag-n-drop
  connectDragSource?: ConnectDragSource;
  connectDragPreview?: ConnectDragPreview;
  connectDropTarget?: ConnectDropTarget;
  isDragging?: boolean;
  isDraggingOver?: boolean;
}

interface State {
  dragDirection: DragDirection;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class KeyValueEditorRowInternal extends PureComponent<Props, State> {
  _nameInput: OneLineEditor | null = null;
  _valueInput: OneLineEditor | null = null;
  _descriptionInput: OneLineEditor | null = null;
  state: State = {
    dragDirection: 0,
  };

  focusNameEnd() {
    if (this._nameInput) {
      this._nameInput.focusEnd();
    }
  }

  focusValueEnd() {
    if (this._valueInput) {
      this._valueInput?.focusEnd();
    }
  }

  focusDescriptionEnd() {
    this._descriptionInput?.focusEnd();
  }

  setDragDirection(dragDirection: DragDirection) {
    if (dragDirection !== this.state.dragDirection) {
      this.setState({
        dragDirection,
      });
    }
  }

  _setDescriptionInputRef(descriptionInput: OneLineEditor) {
    this._descriptionInput = descriptionInput;
  }

  _sendChange(patch: Partial<Pair>) {
    const pair = Object.assign({}, this.props.pair, patch);
    this.props.onChange?.(pair);
  }

  _handleNameChange(name: string) {
    this._sendChange({
      name,
    });
  }

  _handleValuePaste(event: ClipboardEvent) {
    if (!this.props.allowMultiline) {
      return;
    }

    const value = event.clipboardData?.getData('text/plain');

    if (value?.includes('\n')) {
      event.preventDefault();

      // Insert the pasted text into the current selection.
      // Unfortunately, this is the easiest way to do this.
      const currentValue = this._valueInput?.getValue();

      // @ts-expect-error -- TSCONVERSION
      const prefix = currentValue.slice(0, this._valueInput?.getSelectionStart());
      // @ts-expect-error -- TSCONVERSION
      const suffix = currentValue.slice(this._valueInput?.getSelectionEnd());
      const finalValue = `${prefix}${value}${suffix}`;

      // Update type and value
      this._handleTypeChange({
        type: 'text',
        multiline: 'text/plain',
      });

      this._handleValueChange(finalValue);
    }
  }

  _handleValueChange(value: string) {
    this._sendChange({
      value,
    });
  }

  _handleFileNameChange(fileName: string) {
    this._sendChange({
      fileName,
    });
  }

  _handleDescriptionChange(description: string) {
    this._sendChange({
      description,
    });
  }

  _handleTypeChange(def: Partial<Pair>) {
    // Remove newlines if converting to text
    // WARNING: props should never be overwritten!
    let value = this.props.pair.value || '';

    if (def.type === 'text' && !def.multiline && value.includes('\n')) {
      value = value.replace(/\n/g, '');
    }

    this._sendChange({
      type: def.type,
      multiline: def.multiline,
      value,
    });
  }

  _handleDisableChange(disabled: boolean) {
    this._sendChange({
      disabled,
    });
  }

  _handleFocusName(event: FocusEvent) {
    this.props.onFocusName(this.props.pair, event);
  }

  _handleFocusValue(event: FocusEvent) {
    this.props.onFocusValue(this.props.pair, event);
  }

  _handleFocusDescription(event: FocusEvent) {
    this.props.onFocusDescription(this.props.pair, event);
  }

  _handleBlurName(event: FocusEvent) {
    this.props.onBlurName?.(this.props.pair, event);
  }

  _handleBlurValue(event: FocusEvent) {
    this.props.onBlurValue?.(this.props.pair, event);
  }

  _handleBlurDescription(event: FocusEvent) {
    this.props.onBlurDescription?.(this.props.pair, event);
  }

  _handleDelete() {
    this.props.onDelete?.(this.props.pair);
  }

  _handleKeyDown(event: KeyboardEvent, value?: any) {
    this.props.onKeyDown?.(this.props.pair, event, value);
  }

  _handleAutocompleteNames() {
    const { handleGetAutocompleteNameConstants } = this.props;

    if (handleGetAutocompleteNameConstants) {
      return handleGetAutocompleteNameConstants(this.props.pair);
    }

    return [];
  }

  _handleAutocompleteValues() {
    const { handleGetAutocompleteValueConstants } = this.props;

    if (handleGetAutocompleteValueConstants) {
      return handleGetAutocompleteValueConstants(this.props.pair);
    }

    return [];
  }

  _handleEditMultiline() {
    const { pair, enableNunjucks } = this.props;
    showModal(CodePromptModal, {
      submitName: 'Done',
      title: `Edit ${pair.name}`,
      defaultValue: pair.value,
      onChange: this._handleValueChange,
      enableRender: enableNunjucks,
      mode: pair.multiline || 'text/plain',
      onModeChange: (mode: string) => {
        this._handleTypeChange(
          Object.assign({}, pair, {
            multiline: mode,
          }),
        );
      },
    });
  }

  renderPairDescription() {
    const {
      displayDescription,
      readOnly,
      forceInput,
      descriptionPlaceholder,
      pair,
    } = this.props;
    return displayDescription ? (
      <div
        className={classnames(
          'form-control form-control--underlined form-control--wide no-min-width',
          {
            'form-control--inactive': pair.disabled,
          },
        )}
      >
        <OneLineEditor
          ref={this._setDescriptionInputRef}
          readOnly={readOnly}
          forceInput={forceInput}
          placeholder={descriptionPlaceholder || 'Description'}
          defaultValue={pair.description || ''}
          onChange={this._handleDescriptionChange}
          onBlur={this._handleBlurDescription}
          onKeyDown={this._handleKeyDown}
          onFocus={this._handleFocusDescription}
        />
      </div>
    ) : null;
  }

  renderPairValue() {
    const {
      pair,
      readOnly,
      forceInput,
      valueInputType,
      valuePlaceholder,
    } = this.props;

    if (pair.type === 'file') {
      return (
        <FileInputButton
          showFileName
          showFileIcon
          className="btn btn--outlined btn--super-duper-compact wide ellipsis"
          path={pair.fileName || ''}
          onChange={this._handleFileNameChange}
        />
      );
    } else if (pair.type === 'text' && pair.multiline) {
      const bytes = Buffer.from(pair.value, 'utf8').length;
      return (
        <button
          className="btn btn--outlined btn--super-duper-compact wide ellipsis"
          onClick={this._handleEditMultiline}
        >
          <i className="fa fa-pencil-square-o space-right" />
          {bytes > 0 ? describeByteSize(bytes, true) : 'Click to Edit'}
        </button>
      );
    } else {
      return (
        <OneLineEditor
          ref={ref => {
            this._valueInput = ref;
          }}
          readOnly={readOnly}
          forceInput={forceInput}
          type={valueInputType || 'text'}
          placeholder={valuePlaceholder || 'Value'}
          defaultValue={pair.value}
          onPaste={this._handleValuePaste}
          onChange={this._handleValueChange}
          onBlur={this._handleBlurValue}
          onKeyDown={this._handleKeyDown}
          onFocus={this._handleFocusValue}
          getAutocompleteConstants={this._handleAutocompleteValues}
        />
      );
    }
  }

  renderPairSelector() {
    const { hideButtons, allowMultiline, allowFile } = this.props;
    const showDropdown = allowMultiline || allowFile;

    // Put a spacer in for dropdown if needed
    if (hideButtons && showDropdown) {
      return (
        <button>
          <i className="fa fa-empty" />
        </button>
      );
    }

    if (hideButtons) {
      return null;
    }

    if (showDropdown) {
      return (
        <Dropdown right>
          <DropdownButton className="tall">
            <i className="fa fa-caret-down" />
          </DropdownButton>
          <DropdownItem
            onClick={this._handleTypeChange}
            value={{
              type: 'text',
              multiline: false,
            }}
          >
            Text
          </DropdownItem>
          {allowMultiline && (
            <DropdownItem
              onClick={this._handleTypeChange}
              value={{
                type: 'text',
                multiline: true,
              }}
            >
              Text (Multi-line)
            </DropdownItem>
          )}
          {allowFile && (
            <DropdownItem
              onClick={this._handleTypeChange}
              value={{
                type: 'file',
              }}
            >
              File
            </DropdownItem>
          )}
        </Dropdown>
      );
    } else {
      return null;
    }
  }

  render() {
    const {
      pair,
      namePlaceholder,
      sortable,
      noDropZone,
      hideButtons,
      forceInput,
      readOnly,
      className,
      isDragging,
      isDraggingOver,
      noDelete,
      renderLeftIcon,
      connectDragSource,
      connectDragPreview,
      connectDropTarget,
    } = this.props;
    const { dragDirection } = this.state;
    const classes = classnames(className, {
      'key-value-editor__row-wrapper': true,
      'key-value-editor__row-wrapper--dragging': isDragging,
      'key-value-editor__row-wrapper--dragging-above': isDraggingOver && dragDirection > 0,
      'key-value-editor__row-wrapper--dragging-below': isDraggingOver && dragDirection < 0,
      'key-value-editor__row-wrapper--disabled': pair.disabled,
    });

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
              ref={ref => {
                this._nameInput = ref;
              }}
              placeholder={namePlaceholder || 'Name'}
              defaultValue={pair.name}
              getAutocompleteConstants={this._handleAutocompleteNames}
              forceInput={forceInput}
              readOnly={readOnly}
              onBlur={this._handleBlurName}
              onChange={this._handleNameChange}
              onFocus={this._handleFocusName}
              onKeyDown={this._handleKeyDown}
            />
          </div>
          <div
            className={classnames('form-control form-control--underlined form-control--wide', {
              'form-control--inactive': pair.disabled,
            })}
          >
            {this.renderPairValue()}
          </div>
          {this.renderPairDescription()}

          {this.renderPairSelector()}

          {!hideButtons ? (
            <Button
              onClick={this._handleDisableChange}
              value={!pair.disabled}
              title={pair.disabled ? 'Enable item' : 'Disable item'}
            >
              {pair.disabled ? (
                <i className="fa fa-square-o" />
              ) : (
                <i className="fa fa-check-square-o" />
              )}
            </Button>
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
                addIcon
                onClick={this._handleDelete}
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

    if (noDropZone) {
      return row;
    } else {
      const dropTarget = connectDropTarget?.(row);
      // @ts-expect-error -- TSCONVERSION investigate whether a cast is actually appropriate here
      return connectDragPreview?.(dropTarget);
    }
  }
}

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
  drop(props: Props, monitor: DropTargetMonitor, component: any) {
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

const KeyValueEditorRowFCWithRef: ForwardRefRenderFunction<KeyValueEditorRowInternal, Omit<Props, 'enableNunjucks'>> = (
  props,
  ref
) => {
  const { enabled } = useNunjucksEnabled();

  return <KeyValueEditorRowInternal ref={ref} {...props} enableNunjucks={enabled} />;

};

const KeyValueEditorRowFC = forwardRef(KeyValueEditorRowFCWithRef);

const source = DragSource('KEY_VALUE_EDITOR', dragSource, (connect, monitor) => ({
  connectDragSource: connect.dragSource(),
  connectDragPreview: connect.dragPreview(),
  isDragging: monitor.isDragging(),
}))(KeyValueEditorRowFC);

export const Row = DropTarget('KEY_VALUE_EDITOR', dragTarget, (connect, monitor) => ({
  connectDropTarget: connect.dropTarget(),
  isDraggingOver: monitor.isOver(),
}))(source);

Row.prototype.focusNameEnd = function() {
  this.decoratedRef.current.decoratedRef.current.focusNameEnd();
};

Row.prototype.focusValueEnd = function() {
  this.decoratedRef.current.decoratedRef.current.focusValueEnd();
};

Row.prototype.focusDescriptionEnd = function() {
  this.decoratedRef.current.decoratedRef.current.focusDescriptionEnd();
};

// eslint-disable-next-line filenames/match-exported
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { PureComponent } from 'react';
import { ConnectDragPreview, ConnectDragSource, ConnectDropTarget, DragSource, DropTarget } from 'react-dnd';
import ReactDOM from 'react-dom';

import { AUTOBIND_CFG } from '../../../common/constants';
import { describeByteSize } from '../../../common/misc';
import { HandleGetRenderContext, HandleRender } from '../../../common/render';
import Button from '../base/button';
import { Dropdown } from '../base/dropdown/dropdown';
import { DropdownButton } from '../base/dropdown/dropdown-button';
import { DropdownItem } from '../base/dropdown/dropdown-item';
import FileInputButton from '../base/file-input-button';
import PromptButton from '../base/prompt-button';
import OneLineEditor from '../codemirror/one-line-editor';
import CodePromptModal from '../modals/code-prompt-modal';
import { showModal } from '../modals/index';

interface Props {
  onChange: Function;
  onDelete: Function;
  onFocusName: Function;
  onFocusValue: Function;
  onFocusDescription: Function;
  displayDescription: boolean;
  index: number;
  pair: {
    id: string;
    name: string;
    value: string;
    description: string;
    fileName: string;
    type: string;
    disabled: boolean;
  };
  readOnly?: boolean;
  onMove?: Function;
  onKeyDown?: Function;
  onBlurName?: Function;
  onBlurValue?: Function;
  onBlurDescription?: Function;
  handleRender?: HandleRender;
  handleGetRenderContext?: HandleGetRenderContext;
  nunjucksPowerUserMode?: boolean;
  isVariableUncovered?: boolean;
  handleGetAutocompleteNameConstants?: Function;
  handleGetAutocompleteValueConstants?: Function;
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
  dragDirection: number;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class KeyValueEditorRow extends PureComponent<Props, State> {
  _nameInput: OneLineEditor | null = null;
  _valueInput: OneLineEditor | FileInputButton | null = null;
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

  setDragDirection(dragDirection) {
    if (dragDirection !== this.state.dragDirection) {
      this.setState({
        dragDirection,
      });
    }
  }

  _setDescriptionInputRef(n: OneLineEditor) {
    this._descriptionInput = n;
  }

  _sendChange(patch) {
    const pair = Object.assign({}, this.props.pair, patch);
    this.props.onChange?.(pair);
  }

  _handleNameChange(name) {
    this._sendChange({
      name,
    });
  }

  _handleValuePaste(e) {
    if (!this.props.allowMultiline) {
      return;
    }

    const value = e.clipboardData.getData('text/plain');

    if (value?.includes('\n')) {
      e.preventDefault();

      // Insert the pasted text into the current selection.
      // Unfortunately, this is the easiest way to do this.
      // @ts-expect-error -- TSCONVERSION
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

  _handleValueChange(value) {
    this._sendChange({
      value,
    });
  }

  _handleFileNameChange(fileName) {
    this._sendChange({
      fileName,
    });
  }

  _handleDescriptionChange(description) {
    this._sendChange({
      description,
    });
  }

  _handleTypeChange(def) {
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

  _handleDisableChange(disabled) {
    this._sendChange({
      disabled,
    });
  }

  _handleFocusName(e) {
    this.props.onFocusName(this.props.pair, e);
  }

  _handleFocusValue(e) {
    this.props.onFocusValue(this.props.pair, e);
  }

  _handleFocusDescription(e) {
    this.props.onFocusDescription(this.props.pair, e);
  }

  _handleBlurName(e) {
    if (this.props.onBlurName) {
      this.props.onBlurName(this.props.pair, e);
    }
  }

  _handleBlurValue(e) {
    if (this.props.onBlurName) {
      this.props.onBlurValue?.(this.props.pair, e);
    }
  }

  _handleBlurDescription(e: FocusEvent) {
    if (this.props.onBlurDescription) {
      this.props.onBlurDescription(this.props.pair, e);
    }
  }

  _handleDelete() {
    if (this.props.onDelete) {
      this.props.onDelete(this.props.pair);
    }
  }

  _handleKeyDown(e, value) {
    if (this.props.onKeyDown) {
      this.props.onKeyDown(this.props.pair, e, value);
    }
  }

  _handleAutocompleteNames() {
    const { handleGetAutocompleteNameConstants } = this.props;

    if (handleGetAutocompleteNameConstants) {
      return handleGetAutocompleteNameConstants(this.props.pair);
    }
  }

  _handleAutocompleteValues() {
    const { handleGetAutocompleteValueConstants } = this.props;

    if (handleGetAutocompleteValueConstants) {
      return handleGetAutocompleteValueConstants(this.props.pair);
    }
  }

  _handleEditMultiline() {
    const { pair, handleRender, handleGetRenderContext } = this.props;
    showModal(CodePromptModal, {
      submitName: 'Done',
      title: `Edit ${pair.name}`,
      defaultValue: pair.value,
      onChange: this._handleValueChange,
      enableRender: handleRender || handleGetRenderContext,
      // @ts-expect-error -- TSCONVERSION
      mode: pair.multiline || 'text/plain',
      onModeChange: mode => {
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
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode,
      isVariableUncovered,
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
          render={handleRender}
          getRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          isVariableUncovered={isVariableUncovered}
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
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode,
      isVariableUncovered,
    } = this.props;

    if (pair.type === 'file') {
      return (
        <FileInputButton
          ref={ref => { this._valueInput = ref; }}
          showFileName
          showFileIcon
          className="btn btn--outlined btn--super-duper-compact wide ellipsis"
          path={pair.fileName || ''}
          onChange={this._handleFileNameChange}
        />
      );
      // @ts-expect-error -- TSCONVERSION
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
          ref={ref => { this._valueInput = ref; }}
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
          render={handleRender}
          getRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          isVariableUncovered={isVariableUncovered}
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
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode,
      isVariableUncovered,
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
              ref={ref => { this._nameInput = ref; }}
              placeholder={namePlaceholder || 'Name'}
              defaultValue={pair.name}
              render={handleRender}
              getRenderContext={handleGetRenderContext}
              nunjucksPowerUserMode={nunjucksPowerUserMode}
              isVariableUncovered={isVariableUncovered}
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

function isAbove(monitor, component) {
  const hoveredNode = ReactDOM.findDOMNode(component);
  // @ts-expect-error -- TSCONVERSION
  const hoveredTop = hoveredNode.getBoundingClientRect().top;
  // @ts-expect-error -- TSCONVERSION
  const height = hoveredNode.clientHeight;
  const draggedTop = monitor.getSourceClientOffset().y;
  // NOTE: Not quite sure why it's height / 3 (seems to work)
  return hoveredTop > draggedTop - height / 3;
}

const dragTarget = {
  drop(props, monitor, component) {
    if (isAbove(monitor, component)) {
      props.onMove(monitor.getItem().pair, props.pair, 1);
    } else {
      props.onMove(monitor.getItem().pair, props.pair, -1);
    }
  },

  hover(_props, monitor, component) {
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
}))(KeyValueEditorRow);

const target = DropTarget('KEY_VALUE_EDITOR', dragTarget, (connect, monitor) => ({
  connectDropTarget: connect.dropTarget(),
  isDraggingOver: monitor.isOver(),
}))(source);

target.prototype.focusNameEnd = function() {
  this.decoratedRef.current.decoratedRef.current.focusNameEnd();
};

target.prototype.focusValueEnd = function() {
  this.decoratedRef.current.decoratedRef.current.focusValueEnd();
};

target.prototype.focusDescriptionEnd = function() {
  this.decoratedRef.current.decoratedRef.current.focusDescriptionEnd();
};

export default target;

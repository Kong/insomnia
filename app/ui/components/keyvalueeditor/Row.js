import React, {PureComponent, PropTypes} from 'react';
import ReactDOM from 'react-dom';
import autobind from 'autobind-decorator';
import {DragSource, DropTarget} from 'react-dnd';
import classnames from 'classnames';
import FileInputButton from '../base/FileInputButton';
import {Dropdown, DropdownItem, DropdownButton} from '../base/dropdown/index';
import PromptButton from '../base/PromptButton';
import Button from '../base/Button';
import OneLineEditor from '../codemirror/OneLineEditor';

@autobind
class KeyValueEditorRow extends PureComponent {
  constructor (props) {
    super(props);

    this._nameInput = null;
    this._valueInput = null;
    this.state = {
      dragDirection: 0
    };
  }

  focusName () {
    this._nameInput.focus();
  }

  focusValue () {
    this._valueInput.focus();
  }

  setDragDirection (dragDirection) {
    if (dragDirection !== this.state.dragDirection) {
      this.setState({dragDirection});
    }
  }

  _setNameInputRef (n) {
    this._nameInput = n;
  }
  _setValueInputRef (n) {
    this._valueInput = n;
  }

  _sendChange (patch) {
    const pair = Object.assign({}, this.props.pair, patch);
    this.props.onChange && this.props.onChange(pair);
  }

  _handleNameChange (name) {
    this._sendChange({name});
  }
  _handleValueChange (value) {
    this._sendChange({value});
  }
  _handleFileNameChange (fileName) {
    this._sendChange({fileName});
  }
  _handleTypeChange (type) {
    this._sendChange({type});
  }
  _handleDisableChange (disabled) {
    this._sendChange({disabled});
  }

  _handleFocusName (e) {
    this.props.onFocusName(this.props.pair, e);
  }
  _handleFocusValue (e) {
    this.props.onFocusValue(this.props.pair, e);
  }

  _handleBlurName (e) {
    if (this.props.onBlurName) {
      this.props.onBlurName(this.props.pair, e);
    }
  }

  _handleBlurValue (e) {
    if (this.props.onBlurName) {
      this.props.onBlurValue(this.props.pair, e);
    }
  }

  _handleDelete () {
    if (this.props.onDelete) {
      this.props.onDelete(this.props.pair);
    }
  }

  _handleKeyDown (e, value) {
    if (this.props.onKeyDown) {
      this.props.onKeyDown(this.props.pair, e, value);
    }
  }

  render () {
    const {
      pair,
      namePlaceholder,
      valuePlaceholder,
      handleRender,
      valueInputType,
      multipart,
      sortable,
      noDropZone,
      blurOnFocus,
      hideButtons,
      readOnly,
      className,
      isDragging,
      isDraggingOver,
      noDelete,
      connectDragSource,
      connectDragPreview,
      connectDropTarget
    } = this.props;

    const {dragDirection} = this.state;

    const classes = classnames(className, {
      'key-value-editor__row-wrapper': true,
      'key-value-editor__row-wrapper--dragging': isDragging,
      'key-value-editor__row-wrapper--dragging-above': isDraggingOver && dragDirection > 0,
      'key-value-editor__row-wrapper--dragging-below': isDraggingOver && dragDirection < 0,
      'key-value-editor__row-wrapper--disabled': pair.disabled
    });

    let handle = null;
    if (sortable) {
      handle = connectDragSource(
        <div className="key-value-editor__drag">
          <i className={'fa ' + (hideButtons ? 'fa-empty' : 'fa-reorder')}/>
        </div>
      );
    }

    const row = (
      <li className={classes}>
        {handle}
        <div className="key-value-editor__row">
          <div className="form-control form-control--underlined form-control--wide">
            <OneLineEditor
              ref={this._setNameInputRef}
              placeholder={namePlaceholder || 'Name'}
              defaultValue={pair.name}
              render={handleRender}
              blurOnFocus={blurOnFocus}
              readOnly={readOnly}
              onBlur={this._handleBlurName}
              onChange={this._handleNameChange}
              onFocus={this._handleFocusName}
              onKeyDown={this._handleKeyDown}
            />
          </div>
          <div className="form-control form-control--wide wide form-control--underlined">
            {pair.type === 'file' ? (
                <FileInputButton
                  ref={this._setValueInputRef}
                  showFileName
                  className="btn btn--clicky wide ellipsis txt-sm"
                  path={pair.fileName || ''}
                  onChange={this._handleFileNameChange}
                />
              ) : (
                <OneLineEditor
                  blurOnFocus={blurOnFocus}
                  ref={this._setValueInputRef}
                  readOnly={readOnly}
                  type={valueInputType || 'text'}
                  placeholder={valuePlaceholder || 'Value'}
                  defaultValue={pair.value}
                  onChange={this._handleValueChange}
                  onBlur={this._handleBlurValue}
                  render={handleRender}
                  onKeyDown={this._handleKeyDown}
                  onFocus={this._handleFocusValue}
                />
              )}
          </div>

          {multipart ? (
              !hideButtons ? (
                  <Dropdown right>
                    <DropdownButton className="tall">
                      <i className="fa fa-caret-down"></i>
                    </DropdownButton>
                    <DropdownItem onClick={this._handleTypeChange} value="text">
                      Text
                    </DropdownItem>
                    <DropdownItem onClick={this._handleTypeChange} value="file">
                      File
                    </DropdownItem>
                  </Dropdown>
                ) : (
                  <button>
                    <i className="fa fa-empty"/>
                  </button>
                )
            ) : null
          }

          {!hideButtons ? (
              <Button onClick={this._handleDisableChange}
                      value={!pair.disabled}
                      title={pair.disabled ? 'Enable item' : 'Disable item'}>
                {pair.disabled
                  ? <i className="fa fa-square-o"/>
                  : <i className="fa fa-check-square-o"/>
                }
              </Button>
            ) : (
              <button><i className="fa fa-empty"/></button>
            )}

          {!noDelete ? (
              !hideButtons ? (
                  <PromptButton key={Math.random()}
                                tabIndex="-1"
                                confirmMessage=" "
                                addIcon
                                onClick={this._handleDelete}
                                title="Delete item">
                    <i className="fa fa-trash-o"/>
                  </PromptButton>
                ) : (
                  <button>
                    <i className="fa fa-empty"/>
                  </button>
                )
            ) : null}
        </div>
      </li>
    );

    if (noDropZone) {
      return row;
    } else {
      return connectDragPreview(connectDropTarget(row));
    }
  }
}

KeyValueEditorRow.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onFocusName: PropTypes.func.isRequired,
  onFocusValue: PropTypes.func.isRequired,
  index: PropTypes.number.isRequired,
  pair: PropTypes.shape({
    name: PropTypes.string.isRequired,
    value: PropTypes.string,
    fileName: PropTypes.string,
    type: PropTypes.string,
    disabled: PropTypes.bool
  }).isRequired,

  // Optional
  readOnly: PropTypes.bool,
  onMove: PropTypes.func,
  onKeyDown: PropTypes.func,
  onBlurName: PropTypes.func,
  onBlurValue: PropTypes.func,
  handleRender: PropTypes.func,
  namePlaceholder: PropTypes.string,
  valuePlaceholder: PropTypes.string,
  valueInputType: PropTypes.string,
  multipart: PropTypes.bool,
  sortable: PropTypes.bool,
  noDelete: PropTypes.bool,
  noDropZone: PropTypes.bool,
  hideButtons: PropTypes.bool,
  blurOnFocus: PropTypes.bool,

  // For drag-n-drop
  connectDragSource: PropTypes.func,
  connectDragPreview: PropTypes.func,
  connectDropTarget: PropTypes.func,
  isDragging: PropTypes.bool,
  isDraggingOver: PropTypes.bool
};

const dragSource = {
  beginDrag (props) {
    return {pair: props.pair};
  }
};

function isAbove (monitor, component) {
  const hoveredNode = ReactDOM.findDOMNode(component);

  const hoveredTop = hoveredNode.getBoundingClientRect().top;
  const draggedTop = monitor.getSourceClientOffset().y;

  return hoveredTop > draggedTop;
}

const dragTarget = {
  drop (props, monitor, component) {
    if (isAbove(monitor, component)) {
      props.onMove(monitor.getItem().pair, props.pair, 1);
    } else {
      props.onMove(monitor.getItem().pair, props.pair, -1);
    }
  },
  hover (props, monitor, component) {
    if (isAbove(monitor, component)) {
      component.decoratedComponentInstance.setDragDirection(1);
    } else {
      component.decoratedComponentInstance.setDragDirection(-1);
    }
  }
};

function sourceCollect (connect, monitor) {
  return {
    connectDragSource: connect.dragSource(),
    connectDragPreview: connect.dragPreview(),
    isDragging: monitor.isDragging()
  };
}

function targetCollect (connect, monitor) {
  return {
    connectDropTarget: connect.dropTarget(),
    isDraggingOver: monitor.isOver()
  };
}

const source = DragSource('KEY_VALUE_EDITOR', dragSource, sourceCollect)(KeyValueEditorRow);
const target = DropTarget('KEY_VALUE_EDITOR', dragTarget, targetCollect)(source);

target.prototype.focusName = function () {
  this.handler.component.decoratedComponentInstance.focusName();
};

target.prototype.focusValue = function () {
  this.handler.component.decoratedComponentInstance.focusValue();
};

export default target;

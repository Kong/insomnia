import React, {PureComponent, PropTypes} from 'react';
import classnames from 'classnames';
import FileInputButton from '../base/FileInputButton';
import {Dropdown, DropdownItem, DropdownButton} from '../base/dropdown/index';
import PromptButton from '../base/PromptButton';
import Button from '../base/Button';
import OneLineEditor from '../codemirror/OneLineEditor';

class KeyValueEditorRow extends PureComponent {
  _nameInput = null;
  _valueInput = null;

  focusName () {
    this._nameInput.focus();
  }

  focusValue () {
    this._valueInput.focus();
  }

  _setNameInputRef = n => this._nameInput = n;
  _setValueInputRef = n => this._valueInput = n;

  _sendChange = patch => {
    const pair = Object.assign({}, this.props.pair, patch);
    this.props.onChange(this.props.id, pair);
  };

  _handleNameChange = name => this._sendChange({name});
  _handleValueChange = value => this._sendChange({value});
  _handleFileNameChange = filename => this._sendChange({fileName});
  _handleTypeChange = type => this._sendChange({type});
  _handleDisableChange = disabled => this._sendChange({disabled});

  _handleDelete = () => this.props.onDelete(this.props.id);

  _handleFocusName = () => this.props.onFocusName(this.props.id);
  _handleFocusValue = () => this.props.onFocusValue(this.props.id);

  _handleKeyDown = (e, value) => this.props.onKeyDown(this.props.id, e, value);

  render () {
    const {
      pair,
      namePlaceholder,
      valuePlaceholder,
      handleRender,
      valueInputType,
      multipart,
      sortable,
      hideButtons,
      className,
    } = this.props;

    const classes = classnames(
      className,
      'key-value-editor__row',
      {'key-value-editor__row--disabled': pair.disabled},
    );

    return (
      <li className={classes}>
        {sortable ?
          <div className="key-value-editor__row__drag">
            <i className={'fa ' + (hideButtons ? 'fa-empty' : 'fa-reorder')}/>
          </div> : null
        }

        <div className="form-control form-control--underlined form-control--wide">
          <OneLineEditor
            ref={this._setNameInputRef}
            placeholder={namePlaceholder || 'Name'}
            defaultValue={pair.name}
            render={handleRender}
            onChange={this._handleNameChange}
            onFocus={this._handleFocusName}
            onKeyDown={this._handleKeyDown}
          />
        </div>
        <div className="form-control form-control--wide wide form-control--underlined">
          {pair.type === 'file' ? (
              <FileInputButton
                ref={this._setValueInputRef}
                showFileName={true}
                className="btn btn--clicky wide ellipsis txt-sm"
                path={pair.fileName || ''}
                onChange={this._handleFileNameChange}
              />
            ) : (
              <OneLineEditor
                ref={this._setValueInputRef}
                type={valueInputType || 'text'}
                placeholder={valuePlaceholder || 'Value'}
                defaultValue={pair.value}
                onChange={this._handleValueChange}
                render={handleRender}
                onKeyDown={this._handleKeyDown}
                onFocus={this._handleFocusValue}
              />
            )}
        </div>

        {multipart ? (
            <Dropdown right={true}>
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
          ) : null}

        {!hideButtons ? (
            <Button onClick={this._handleDisableChange}
                    value={!pair.disabled}
                    title={pair.disabled ? 'Enable item' : 'Disable item'}>
              {pair.disabled ?
                <i className="fa fa-square-o"/> :
                <i className="fa fa-check-square-o"/>
              }
            </Button>
          ) : (
            <button>
              <i className="fa fa-empty"/>
            </button>
          )}

        {!hideButtons ? (
            <PromptButton key={Math.random()}
                          tabIndex="-1"
                          confirmMessage=" "
                          addIcon={true}
                          onClick={this._handleDelete}
                          title="Delete item">
              <i className="fa fa-trash-o"/>
            </PromptButton>
          ) : (
            <button>
              <i className="fa fa-empty"/>
            </button>
          )}
      </li>
    )
  }
}

KeyValueEditorRow.propTypes = {
  // Required
  id: PropTypes.any.isRequired,
  onChange: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
  onFocusName: PropTypes.func.isRequired,
  onFocusValue: PropTypes.func.isRequired,
  onKeyDown: PropTypes.func,
  pair: PropTypes.shape({
    name: PropTypes.string.isRequired,
    value: PropTypes.string,
    fileName: PropTypes.string,
    type: PropTypes.string,
    disabled: PropTypes.bool,
  }).isRequired,

  // Optional
  handleRender: PropTypes.func,
  namePlaceholder: PropTypes.string,
  valuePlaceholder: PropTypes.string,
  valueInputType: PropTypes.string,
  multipart: PropTypes.bool,
  sortable: PropTypes.bool,
  hideButtons: PropTypes.bool,
};

export default KeyValueEditorRow;

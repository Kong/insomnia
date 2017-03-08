import React, {PureComponent, PropTypes} from 'react';
import autobind from 'autobind-decorator';

@autobind
class Editable extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      editing: false
    };
  }

  _handleSetInputRef (n) {
    this._input = n;
  }

  _handleSingleClickEditStart () {
    if (this.props.singleClick) {
      this._handleEditStart();
    }
  }

  _handleEditStart () {
    this.setState({editing: true});

    setTimeout(() => {
      this._input && this._input.focus();
      this._input && this._input.select();
    });

    if (this.props.onEditStart) {
      this.props.onEditStart();
    }
  }

  _handleEditEnd () {
    const value = this._input.value.trim();

    if (!value) {
      // Don't do anything if it's empty
      return;
    }

    this.props.onSubmit(value);

    // This timeout prevents the UI from showing the old value after submit.
    // It should give the UI enough time to redraw the new value.
    setTimeout(async () => this.setState({editing: false}), 100);
  }

  _handleEditKeyDown (e) {
    if (e.keyCode === 13) {
      // Pressed Enter
      this._handleEditEnd();
    } else if (e.keyCode === 27) {
      // Pressed Escape
      // NOTE: This blur causes a save because we save on blur
      // TODO: Make escape blur without saving
      this._input && this._input.blur();
    }
  }

  render () {
    const {
      value,
      singleClick, // eslint-disable-line no-unused-vars
      onEditStart, // eslint-disable-line no-unused-vars
      className,
      ...extra
    } = this.props;
    const {editing} = this.state;

    if (editing) {
      return (
        <input {...extra}
               className={`editable ${className}`}
               type="text"
               ref={this._handleSetInputRef}
               defaultValue={value}
               onKeyDown={this._handleEditKeyDown}
               onBlur={this._handleEditEnd}
        />
      );
    } else {
      return (
        <div {...extra}
             className={`editable ${className}`}
             onClick={this._handleSingleClickEditStart}
             onDoubleClick={this._handleEditStart}>
          {value}
        </div>
      );
    }
  }
}

Editable.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired,

  // Optional
  singleClick: PropTypes.bool,
  onEditStart: PropTypes.func,
  className: PropTypes.string
};

export default Editable;

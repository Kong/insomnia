import React, {Component, PropTypes} from 'react';
import * as misc from '../../../common/misc';

class Editable extends Component {
  constructor (props) {
    super(props);
    this.state = {
      editing: false
    }
  }

  _handleEditStart () {
    this.setState({editing: true});

    setTimeout(() => {
      this._input && this._input.focus();
      this._input && this._input.select();
    });
  }

  async _handleEditEnd () {
    const value = this._input.value.trim();

    if (!value) {
      // Don't do anything if it's empty
      return;
    }

    this.props.onSubmit(value);

    // This timeout prevents the UI from showing the old value after submit.
    // It should give the UI enough time to redraw the new value.
    await misc.delay(100);
    this.setState({editing: false});
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
    const {value, singleClick, ...extra} = this.props;
    const {editing} = this.state;

    if (editing) {
      return (
        <input
          className="editable"
          type="text"
          ref={n => this._input = n}
          defaultValue={value}
          onKeyDown={e => this._handleEditKeyDown(e)}
          onBlur={e => this._handleEditEnd()}
          {...extra}
        />
      )
    } else {
      return (
        <div className="editable"
             onClick={e => singleClick && this._handleEditStart()}
             onDoubleClick={e => this._handleEditStart()} {...extra}>
          {value}
        </div>
      )
    }
  }
}

Editable.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired,

  // Optional
  singleClick: PropTypes.bool
};

export default Editable;

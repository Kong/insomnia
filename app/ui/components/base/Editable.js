import React, {Component, PropTypes} from 'react';
import {DEBOUNCE_MILLIS} from '../../../lib/constants';

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

  _handleEditEnd () {
    const value = this._input.value.trim();

    if (!value) {
      // Don't do anything if it's empty
      return;
    }

    // This timeout prevents the UI from showing the old value after submit.
    // It should give the UI enough time to redraw the new value.
    setTimeout(() => {
      this.setState({editing: false});
    }, DEBOUNCE_MILLIS);

    this.props.onSubmit(value);
  }

  _handleEditKeyDown (e) {
    if (e.keyCode === 13) {
      // Pressed Enter
      this._handleEditEnd();
    } else if (e.keyCode === 27) {
      // Pressed Escape
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

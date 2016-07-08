import React, {Component, PropTypes} from 'react';
import ReactDOM from 'react-dom'

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
      this.refs.input && this.refs.input.focus();
    });
  }

  _handleEditEnd () {
    this.setState({editing: false})
    this.props.onSubmit(this.refs.input.value);
  }

  _handleEditKeyDown (e) {
    if (e.keyCode === 13) {
      // Pressed Enter
      this._handleEditEnd();
    } else if (e.keyCode === 27) {
      // Pressed Escape
      this.refs.input && this.refs.input.blur();
    }
  }

  render () {
    const {value, ...extra} = this.props;
    const {editing} = this.state;

    if (editing) {
      return (
        <input
          type="text"
          ref="input"
          defaultValue={value}
          onKeyDown={e => this._handleEditKeyDown(e)}
          onBlur={e => this._handleEditEnd()}
          {...extra}
        />
      )
    } else {
      return (
        <span onDoubleClick={e => this._handleEditStart()} {...extra}>{value}</span>
      )
    }
  }
}

Editable.propTypes = {
  onSubmit: PropTypes.func.isRequired,
  value: PropTypes.string.isRequired
}

export default Editable;

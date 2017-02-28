import React, {PureComponent, PropTypes} from 'react';
import {debounce} from '../../../common/misc';

class DebouncedInput extends PureComponent {
  _handleValueChange = debounce(this.props.onChange, 500);
  _handleChange = e => this._handleValueChange(e.target.value);

  render () {
    // NOTE: Strip out onChange because we're overriding it
    const {onChange, textarea, ...props} = this.props;
    if (textarea) {
      return (
        <textarea {...props} onChange={this._handleChange}/>
      )
    } else {
      return (
        <input {...props} onChange={this._handleChange}/>
      )
    }
  }
}

DebouncedInput.propTypes = {
  // Required
  onChange: PropTypes.func.isRequired,

  // Optional
  textarea: PropTypes.bool,
};

export default DebouncedInput;

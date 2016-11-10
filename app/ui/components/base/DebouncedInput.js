import React, {Component, PropTypes} from 'react';
import * as misc from '../../../common/misc';

class DebouncedInput extends Component {
  constructor (props) {
    super(props);

    // NOTE: Cannot debounce props.onChange directly because react events aren't
    // allowed to be used after a timeout :(
    const debouncedOnChange = misc.debounce(value => this.props.onChange(value));
    const onChangeFn = e => debouncedOnChange(e.target.value);
    this._onChange = onChangeFn.bind(this);
  }

  render () {
    // NOTE: Strip out onChange because we're overriding it
    const {onChange, ...props} = this.props;
    return <input {...props} onChange={this._onChange}/>
  }
}

DebouncedInput.propTypes = {
  onChange: PropTypes.func.isRequired,
};

export default DebouncedInput;

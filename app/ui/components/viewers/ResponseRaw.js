import React, {PureComponent, PropTypes} from 'react';
import autobind from 'autobind-decorator';
import {debounce} from '../../../common/misc';

@autobind
class ResponseRaw extends PureComponent {
  constructor (props) {
    super(props);

    // Use a timeout so it doesn't block the UI
    this._update = debounce(this._setTextAreaValue);
  }

  _setTextAreaValue (value) {
    // Bail if we're not mounted
    if (!this._textarea) {
      return;
    }

    this._textarea.value = value;
  }

  componentDidUpdate () {
    this._update(this.props.value)
  }

  componentDidMount () {
    this._update(this.props.value)
  }

  shouldComponentUpdate (nextProps) {
    for (let key in nextProps) {
      if (nextProps.hasOwnProperty(key)) {
        if (nextProps[key] !== this.props[key]) {
          return true;
        }
      }
    }

    return false;
  }

  render () {
    const {fontSize} = this.props;
    return (
      <textarea
        ref={n => this._textarea = n}
        placeholder="..."
        className="force-wrap scrollable wide tall selectable monospace pad no-resize"
        readOnly
        defaultValue=""
        style={{fontSize}}>
      </textarea>
    );
  }
}

ResponseRaw.propTypes = {
  value: PropTypes.string.isRequired,
  fontSize: PropTypes.number
};

export default ResponseRaw;

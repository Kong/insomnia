import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';

@autobind
class ResponseRaw extends PureComponent {
  constructor(props) {
    super(props);
    this._timeout = null;
  }

  _setTextAreaRef(n) {
    this._textarea = n;
  }

  _update(value) {
    clearTimeout(this._timeout);
    this._timeout = setTimeout(() => {
      if (this._textarea) {
        this._textarea.value = value;
      }
    }, 200);
  }

  componentDidUpdate() {
    this._update(this.props.value);
  }

  componentDidMount() {
    this._update(this.props.value);
  }

  shouldComponentUpdate(nextProps) {
    for (let key in nextProps) {
      if (nextProps.hasOwnProperty(key)) {
        if (nextProps[key] !== this.props[key]) {
          return true;
        }
      }
    }

    return false;
  }

  render() {
    const { fontSize } = this.props;
    return (
      <textarea
        ref={this._setTextAreaRef}
        placeholder="..."
        className="force-wrap scrollable wide tall selectable monospace pad no-resize"
        readOnly
        defaultValue=""
        style={{ fontSize }}
      />
    );
  }
}

ResponseRaw.propTypes = {
  value: PropTypes.string.isRequired,
  fontSize: PropTypes.number
};

export default ResponseRaw;

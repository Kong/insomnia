import React, {Component, PropTypes} from 'react'

class TimeTag extends Component {
  render () {
    const {milliseconds} = this.props;

    return (
      <div className="tag">
        <strong>TIME</strong>&nbsp;{milliseconds} ms
      </div>
    );
  }
}

TimeTag.propTypes = {
  milliseconds: PropTypes.number.isRequired
};

export default TimeTag;

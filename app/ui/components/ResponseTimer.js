import React, {PureComponent, PropTypes} from 'react';
import {REQUEST_TIME_TO_SHOW_COUNTER} from '../../common/constants';

class ResponseTimer extends PureComponent {
  render () {
    const {loadStartTime, className, handleCancel} = this.props;

    if (loadStartTime < 0) {
      return null;
    }

    // Set a timer to update the UI again soon
    setTimeout(() => {
      this.forceUpdate();
    }, 100);

    const millis = Date.now() - loadStartTime - 200;
    const elapsedTime = Math.round(millis / 100) / 10;

    return (
      <div className={className}>
        {elapsedTime > REQUEST_TIME_TO_SHOW_COUNTER ? (
          <h2>{elapsedTime} seconds...</h2>
        ) : (
          <h2>Loading...</h2>
        )}

        <br/>
        <i className="fa fa-refresh fa-spin"></i>

        <br/>
        <div className="pad">
          <button className="btn btn--clicky" onClick={handleCancel}>
            Cancel Request
          </button>
        </div>
      </div>
    )
  }
}

ResponseTimer.propTypes = {
  handleCancel: PropTypes.func.isRequired,
  loadStartTime: PropTypes.number.isRequired,
};

export default ResponseTimer;

import React, {PureComponent} from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import {REQUEST_TIME_TO_SHOW_COUNTER} from '../../common/constants';

class ResponseTimer extends PureComponent {
  constructor (props) {
    super(props);
    this._interval = null;
    this.state = {
      elapsedTime: 0
    };
  }

  componentWillUnmount () {
    clearInterval(this._interval);
  }

  componentWillReceiveProps (nextProps) {
    const {loadStartTime} = nextProps;

    if (loadStartTime <= 0) {
      clearInterval(this._interval);
      return;
    }

    clearInterval(this._interval); // Just to be sure
    this._interval = setInterval(() => {
      const millis = Date.now() - loadStartTime - 200;
      const elapsedTime = Math.round(millis / 100) / 10;
      this.setState({elapsedTime});
    }, 100);
  }

  render () {
    const {handleCancel, loadStartTime} = this.props;
    const {elapsedTime} = this.state;

    const show = loadStartTime > 0;

    return (
      <div className={classnames('overlay theme--overlay', {'overlay--hidden': !show})}>
        {elapsedTime > REQUEST_TIME_TO_SHOW_COUNTER
          ? <h2>{elapsedTime.toFixed(1)} seconds...</h2>
          : <h2>Loading...</h2>
        }
        <div className="pad">
          <i className="fa fa-refresh fa-spin"/>
        </div>
        <div className="pad">
          <button className="btn btn--clicky" onClick={handleCancel}>
            Cancel Request
          </button>
        </div>
      </div>
    );
  }
}

ResponseTimer.propTypes = {
  handleCancel: PropTypes.func.isRequired,
  loadStartTime: PropTypes.number.isRequired
};

export default ResponseTimer;

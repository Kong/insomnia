import React, {PureComponent, PropTypes} from 'react';
import classnames from 'classnames';
import {REQUEST_TIME_TO_SHOW_COUNTER} from '../../common/constants';

class ResponseTimer extends PureComponent {
  constructor (props) {
    super(props);
    this._interval = null;
    this.state = {
      show: false,
      elapsedTime: 0
    };
  }

  componentWillUnmount () {
    clearInterval(this._interval);
  }

  componentDidMount () {
    this._interval = setInterval(() => {
      const {loadStartTime} = this.props;
      if (loadStartTime > 0) {
        // Show and update if needed
        const millis = Date.now() - loadStartTime - 200;
        const elapsedTime = Math.round(millis / 100) / 10;
        this.setState({show: true, elapsedTime});
      } else if (this.state.show) {
        // Hide if needed
        this.setState({show: false});
      }
    }, 100);
  }

  render () {
    const {handleCancel} = this.props;
    const {show, elapsedTime} = this.state;

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

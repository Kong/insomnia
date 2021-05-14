import React, { DOMAttributes, PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { REQUEST_TIME_TO_SHOW_COUNTER, AUTOBIND_CFG } from '../../common/constants';

interface Props {
  handleCancel: DOMAttributes<HTMLButtonElement>['onClick'],
  loadStartTime: number,
}

interface State {
  elapsedTime: number;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class ResponseTimer extends PureComponent<Props, State> {
  interval: NodeJS.Timeout | null = null;

  state: State = {
    elapsedTime: 0,
  };

  componentWillUnmount() {
    if (this.interval === null) {
      return;
    }
    clearInterval(this.interval);
  }

  handleUpdateElapsedTime() {
    const { loadStartTime } = this.props;
    const millis = Date.now() - loadStartTime - 200;
    const elapsedTime = millis / 1000;
    this.setState({ elapsedTime });
  }

  componentDidUpdate() {
    const { loadStartTime } = this.props;

    if (loadStartTime <= 0) {
      if (this.interval !== null) {
        clearInterval(this.interval);
      }
      return;
    }

    if (this.interval !== null) {
      // Just to be sure
      clearInterval(this.interval);
    }

    this.interval = setInterval(this.handleUpdateElapsedTime, 100);
    this.handleUpdateElapsedTime();
  }

  render() {
    const { handleCancel, loadStartTime } = this.props;
    const { elapsedTime } = this.state;

    if (loadStartTime <= 0) {
      return null;
    }

    return (
      <div className="overlay theme--transparent-overlay">
        {elapsedTime >= REQUEST_TIME_TO_SHOW_COUNTER ? (
          <h2>{elapsedTime.toFixed(1)} seconds...</h2>
        ) : (
          <h2>Loading...</h2>
        )}
        <div className="pad">
          <i className="fa fa-refresh fa-spin" />
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

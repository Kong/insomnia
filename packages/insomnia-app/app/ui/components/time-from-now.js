// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import moment from 'moment';

type Props = {
  timestamp: number | Date | string,
  intervalSeconds?: number,
  className?: string,
};

type State = {
  text: string,
};

@autobind
class TimeFromNow extends React.PureComponent<Props, State> {
  _interval: any;

  constructor(props: any) {
    super(props);
    this._interval = null;
    this.state = {
      text: '',
    };
  }

  _update() {
    const { timestamp } = this.props;
    this.setState({ text: moment(timestamp).fromNow() });
  }

  componentDidMount() {
    const intervalSeconds = this.props.intervalSeconds || 5;
    this._interval = setInterval(this._update, intervalSeconds * 1000);
    this._update();
  }

  componentWillUnmount() {
    clearInterval(this._interval);
  }

  render() {
    const { className, timestamp } = this.props;
    const { text } = this.state;
    return (
      <span title={moment(timestamp).toString()} className={className}>
        {text}
      </span>
    );
  }
}

export default TimeFromNow;

import { autoBindMethodsForReact } from 'class-autobind-decorator';
import moment from 'moment';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../common/constants';

interface Props {
  timestamp: number | Date | string;
  intervalSeconds?: number;
  className?: string;
  capitalize?: boolean;
}

interface State {
  text: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class TimeFromNow extends PureComponent<Props, State> {
  _interval: NodeJS.Timeout | null = null;

  state: State = {
    text: '',
  };

  _update() {
    const { timestamp, capitalize } = this.props;
    let text = moment(timestamp).fromNow();

    // Shorten default case
    if (text === 'a few seconds ago') {
      text = 'just now';
    }

    // Capitalize if needed
    if (capitalize) {
      text = text.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
      });
    }

    this.setState({
      text,
    });
  }

  componentDidMount() {
    const intervalSeconds = this.props.intervalSeconds || 5;
    this._interval = setInterval(this._update, intervalSeconds * 1000);

    this._update();
  }

  componentWillUnmount() {
    if (this._interval !== null) {
      clearInterval(this._interval);
    }
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

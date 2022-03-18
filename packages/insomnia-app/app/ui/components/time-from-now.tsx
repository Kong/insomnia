import { autoBindMethodsForReact } from 'class-autobind-decorator';
import moment from 'moment';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../common/constants';
import { toTitleCase } from '../../common/misc';

interface Props {
  timestamp: number | Date | string;
  intervalSeconds?: number;
  className?: string;
  titleCase?: boolean;
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

    if (titleCase) {
      text = toTitleCase(text);
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

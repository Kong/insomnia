import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { differenceInMinutes, formatDistanceToNowStrict } from 'date-fns';
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
    const { timestamp, titleCase } = this.props;
    const date = new Date(timestamp);

    let text = formatDistanceToNowStrict(date, { addSuffix: true });

    const lessThanOneMinuteAgo = differenceInMinutes(Date.now(), date) < 1;
    if (lessThanOneMinuteAgo) {
      text = 'just now';
    }

    if (titleCase) {
      text = toTitleCase(text);
    }

    this.setState({ text });
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
      <span title={new Date(timestamp).toLocaleString()} className={className}>
        {text}
      </span>
    );
  }
}

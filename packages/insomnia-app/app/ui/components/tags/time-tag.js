// @flow
import * as React from 'react';
import classnames from 'classnames';
import Tooltip from '../tooltip';

type Props = {
  milliseconds: number,

  // Optional
  small?: boolean,
  className?: string
};

class TimeTag extends React.PureComponent<Props> {
  render() {
    const { milliseconds, small, className } = this.props;

    let unit = 'ms';
    let number = milliseconds;

    if (milliseconds > 1000 * 60) {
      unit = 'm';
      number = milliseconds / 1000 / 60;
    } else if (milliseconds > 1000) {
      unit = 's';
      number = milliseconds / 1000;
    }

    // Round to 0, 1, 2 decimal places depending on how big the number is
    if (number > 100) {
      number = Math.round(number);
    } else if (number > 10) {
      number = Math.round(number * 10) / 10;
    } else {
      number = Math.round(number * 100) / 100;
    }

    let description = `${milliseconds.toFixed(3)} milliseconds`;
    return (
      <div className={classnames('tag', { 'tag--small': small }, className)}>
        <Tooltip message={description} position="bottom">
          <strong>TIME</strong> {number} {unit}
        </Tooltip>
      </div>
    );
  }
}

export default TimeTag;

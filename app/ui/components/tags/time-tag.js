import React, {PropTypes, PureComponent} from 'react';
import classnames from 'classnames';

class TimeTag extends PureComponent {
  render () {
    const {
      milliseconds,
      small,
      className
    } = this.props;

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
      <div className={classnames('tag', {'tag--small': small}, className)} title={description}>
        <strong>TIME</strong> {number} {unit}
      </div>
    );
  }
}

TimeTag.propTypes = {
  // Required
  milliseconds: PropTypes.number.isRequired,

  // Optional
  small: PropTypes.bool,
  className: PropTypes.string
};

export default TimeTag;

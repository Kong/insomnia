import React, {Component, PropTypes} from 'react';

class Nl2Br extends Component {
  render () {
    const {children, ...props} = this.props;
    const text = children || '';
    const lines = text.trim().split('\n');
    return (
      <p {...props}>{lines.map((l, i) => {
        const trimmed = l.trim();
        if (trimmed) {
          const brs = i < lines.length - 1 ? [<br/>] : [];
          return [trimmed, ...brs];
        } else {
          return null;
        }
      })}</p>
    );
  }
}

Nl2Br.propTypes = {};

export default Nl2Br;

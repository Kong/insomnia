import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import crypto from 'crypto';

class GravatarImg extends PureComponent {
  render() {
    const { email, size: rawSize, className } = this.props;
    const size = rawSize || 100;
    const sanitizedEmail = email.trim().toLowerCase();
    const hash = crypto
      .createHash('md5')
      .update(sanitizedEmail)
      .digest('hex');
    const url = `https://www.gravatar.com/avatar/${hash}?s=${size * 2}`;
    const cssSize = `${size}px`;
    return (
      <img
        src={url}
        alt="Profile picture"
        className={className}
        title={sanitizedEmail}
        style={{ width: cssSize, height: cssSize }}
      />
    );
  }
}

GravatarImg.propTypes = {
  // Required
  email: PropTypes.string.isRequired,

  // Optional
  size: PropTypes.number,
  className: PropTypes.string
};

export default GravatarImg;

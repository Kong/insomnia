import React, {PureComponent, PropTypes} from 'react';
import crypto from 'crypto';

class GravatarImg extends PureComponent {
  render () {
    const {email, size, className} = this.props;
    const sanitizedEmail = email.trim().toLowerCase();
    const hash = crypto
      .createHash('md5')
      .update(sanitizedEmail)
      .digest('hex');
    const url = `https://www.gravatar.com/avatar/${hash}?s=${size * 2}`;
    const cssSize = `${size}px`;
    return (
      <img src={url}
           alt="Profile picture"
           className={className}
           title={sanitizedEmail}
           style={{width: cssSize, height: cssSize}}/>
    );
  }
}

GravatarImg.propTypes = {
  email: PropTypes.string.isRequired,
  size: PropTypes.number
};

export default GravatarImg;

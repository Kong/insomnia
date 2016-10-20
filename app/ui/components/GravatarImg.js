import React, {Component, PropTypes} from 'react';
import crypto from 'crypto';

class GravatarImg extends Component {
  render () {
    const {email, size} = this.props;
    const sanitizedEmail = email.trim().toLowerCase();
    const hash = crypto
      .createHash('md5')
      .update(sanitizedEmail)
      .digest('hex');
    const url = `https://www.gravatar.com/avatar/${hash}?s=${size || 50}`;
    return (
      <img src={url} alt="Profile picture"/>
    )
  }
}

GravatarImg.propTypes = {
  email: PropTypes.string.isRequired,
  size: PropTypes.number
};

export default GravatarImg;

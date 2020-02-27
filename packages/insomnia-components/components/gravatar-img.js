// @flow
import * as React from 'react';
import crypto from 'crypto';

type Props = {|
  email?: string,
  size?: number,
  fallback?: string,
  className?: string,
  rounded?: boolean,
  title?: string,
  alt?: string,
|};

class GravatarImg extends React.PureComponent<Props> {
  render() {
    const { email, size: rawSize, className, fallback, rounded, title, alt } = this.props;
    const size = rawSize || 100;
    let src = fallback;

    if (email) {
      const hash = crypto
        .createHash('md5')
        .update(email.trim().toLowerCase())
        .digest('hex');
      src = `https://www.gravatar.com/avatar/${hash}?s=${size * 2}`;
    }

    const cssSize = `${size}px`;
    return (
      <img
        src={src}
        alt={alt}
        title={title}
        className={className}
        style={{ width: cssSize, height: cssSize, borderRadius: rounded ? cssSize : null }}
      />
    );
  }
}

export default GravatarImg;

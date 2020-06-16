// @flow
import * as React from 'react';
import md5 from 'md5';

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
      const hash = md5(email.trim().toLowerCase());
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

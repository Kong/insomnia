import React, { PureComponent } from 'react';

class NetrcAuth extends PureComponent {
  render() {
    return (
      <div className="vertically-center text-center">
        <p className="pad super-faint text-sm text-center">
          <br />
          Your netrc file will be used to authenticate this request
        </p>
      </div>
    );
  }
}

export default NetrcAuth;

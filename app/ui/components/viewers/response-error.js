import React, {PureComponent, PropTypes} from 'react';

import Link from '../base/link';
import {showModal} from '../modals/index';
import SettingsModal from '../modals/settings-modal';
import {STATUS_CODE_RENDER_FAILED} from '../../../common/constants';

class ResponseError extends PureComponent {
  render () {
    const {error, statusCode, fontSize} = this.props;

    let msg = null;
    if (statusCode === STATUS_CODE_RENDER_FAILED) {
      msg = (
        <Link button
              className="btn btn--clicky"
              href="https://insomnia.rest/documentation/templating/">
          Template Documentation
        </Link>
      );
    } else if (error && error.toLowerCase().indexOf('certificate') !== -1) {
      msg = (
        <button className="btn btn--clicky" onClick={() => showModal(SettingsModal)}>
          Disable SSL Validation
        </button>
      );
    } else if (error && error.toLowerCase().indexOf('getaddrinfo') !== -1) {
      msg = (
        <button className="btn btn--clicky" onClick={() => showModal(SettingsModal)}>
          Setup Network Proxy
        </button>
      );
    } else {
      msg = (
        <Link button
              className="btn btn--clicky"
              href="https://insomnia.rest/documentation/">
          Documentation
        </Link>
      );
    }

    return (
      <div>
        <pre className="selectable pad force-word-wrap" style={{fontSize: `${fontSize}px`}}>
          {error}
        </pre>
        <hr/>
        <div className="text-center pad">
          <p className="faint pad-left pad-right">
            Here are some additional things that may help.
          </p>
          {msg}
          &nbsp;&nbsp;
          <Link button className="btn btn--clicky margin-top-sm"
                href="https://insomnia.rest/documentation/support-and-feedback/">
            Contact Support
          </Link>
        </div>
      </div>
    );
  }
}

ResponseError.propTypes = {
  // Required
  error: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired,
  statusCode: PropTypes.number.isRequired,
  fontSize: PropTypes.number.isRequired
};

export default ResponseError;

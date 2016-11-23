import React, {Component, PropTypes} from 'react';

import Link from '../../components/base/Link';
import {showModal} from '../modals/index';
import SettingsModal from '../modals/SettingsModal';

class ResponseError extends Component {
  render () {
    const {error} = this.props;

    let msg = null;
    if (error && error.toLowerCase().indexOf('certificate') !== -1) {
      msg = (
        <button className="btn btn--super-compact btn--outlined"
                onClick={() => showModal(SettingsModal)}>
          Disable SSL Validation
        </button>
      )
    } else if (error && error.toLowerCase().indexOf('getaddrinfo') !== -1) {
      msg = (
        <button className="btn btn--super-compact btn--outlined"
                onClick={() => showModal(SettingsModal)}>
          Setup Network Proxy
        </button>
      )
    } else {
      msg = (
        <Link button={true}
              className="btn btn--super-compact btn--outlined"
              href="https://insomnia.rest/documentation/">
          Documentation
        </Link>
      )
    }

    return (
      <div>
        <pre className="selectable pad force-word-wrap">
          {error}
        </pre>
        <hr/>
        <div className="text-center pad">
          <p className="faint pad-left pad-right">
            Here are some additional things that may help.
          </p>
          {msg}
          &nbsp;&nbsp;
          <Link button={true} className="btn btn--super-compact btn--outlined margin-top-sm"
                href="https://insomnia.rest/documentation/support-and-feedback/">
            Contact Support
          </Link>
        </div>
      </div>
    );
  }
}

ResponseError.propTypes = {
  error: PropTypes.string.isRequired,
  url: PropTypes.string.isRequired
};

export default ResponseError;


import React, {Component, PropTypes} from 'react';

import Link from '../../components/base/Link';
import {getModal} from '../modals/index';
import SettingsModal from '../modals/SettingsModal';

class ResponseError extends Component {
  render () {
    const {error} = this.props;

    let msg = null;
    if (error && error.toLowerCase().indexOf('certificate') !== -1) {
      msg = (
        <button className="btn btn--super-compact btn--outlined"
                onClick={() => getModal(SettingsModal).show()}>
          Disable SSL Validation
        </button>
      )
    } else if (error && error.toLowerCase().indexOf('getaddrinfo') !== -1) {
      msg = (
        <button className="btn btn--super-compact btn--outlined"
                onClick={() => getModal(SettingsModal).show()}>
          Setup Network Proxy
        </button>
      )
    } else {
      msg = (
        <Link button={true} className="btn btn--super-compact btn--outlined"
                href="http://docs.insomnia.rest">
          View the Docs
        </Link>
      )
    }

    return (
      <div>
        <div className="monospace pad">
          {error}
        </div>
        <hr/>
        <div className="text-center pad">
          <p className="faint pad-left pad-right">
            That error looks strange. Maybe this will help.
          </p>
          {msg}
          &nbsp;&nbsp;
          <Link button={true} className="btn btn--super-compact btn--outlined margin-top-sm"
                href="mailto:support@insomnia.rest">
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


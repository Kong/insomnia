import React, { PureComponent } from 'react';

import Link from '../base/link';
import { showModal } from '../modals/index';
import SettingsModal from '../modals/settings-modal';

interface Props {
  error: string,
  url: string,
  fontSize: number,
}
class ResponseError extends PureComponent<Props> {
  render() {
    const { error, fontSize } = this.props;
    let msg: React.ReactNode = null;

    if (error && error.toLowerCase().indexOf('certificate') !== -1) {
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
        <Link button className="btn btn--clicky" href="https://support.insomnia.rest">
          Documentation
        </Link>
      );
    }

    return (
      <div>
        <pre
          className="selectable pad force-pre-wrap"
          style={{
            fontSize: `${fontSize}px`,
          }}>
          {error}
        </pre>
        <hr />
        <div className="text-center pad">
          <p className="faint pad-left pad-right">Here are some additional things that may help.</p>
          {msg}
          &nbsp;&nbsp;
          <Link
            button
            className="btn btn--clicky margin-top-sm"
            href="https://insomnia.rest/support">
            Contact Support
          </Link>
        </div>
      </div>
    );
  }
}

export default ResponseError;

import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import autobind from 'autobind-decorator';
import { Cookie } from 'tough-cookie';

@autobind
class ResponseCookiesViewer extends PureComponent {
  renderRow(h, i) {
    let cookie = null;
    try {
      cookie = h ? Cookie.parse(h.value || '') : null;
    } catch (err) {
      console.warn('Failed to parse set-cookie header', h);
    }

    const blank = <span className="super-duper-faint italic">--</span>;
    return (
      <tr className="selectable" key={i}>
        <td>{cookie ? cookie.key : blank}</td>
        <td className="force-wrap">{cookie ? cookie.value : blank}</td>
      </tr>
    );
  }

  render() {
    const {
      headers,
      showCookiesModal,
      cookiesSent,
      cookiesStored
    } = this.props;

    const notifyNotStored = !cookiesStored && headers.length;

    let noticeMessage = null;
    if (!cookiesSent && notifyNotStored) {
      noticeMessage = 'sending and storing';
    } else if (!cookiesSent) {
      noticeMessage = 'sending';
    } else if (notifyNotStored) {
      noticeMessage = 'storing';
    }

    return (
      <div>
        {noticeMessage && (
          <div className="notice info margin-bottom no-margin-top">
            <p>
              Automatic {noticeMessage} of cookies was disabled at the time this
              request was made
            </p>
          </div>
        )}

        <table className="table--fancy table--striped table--compact">
          <thead>
            <tr>
              <th>Name</th>
              <th>Value</th>
            </tr>
          </thead>
          <tbody>
            {!headers.length
              ? this.renderRow(null, -1)
              : headers.map(this.renderRow)}
          </tbody>
        </table>
        <p className="pad-top">
          <button
            className="pull-right btn btn--clicky"
            onClick={e => showCookiesModal()}>
            Manage Cookies
          </button>
        </p>
      </div>
    );
  }
}

ResponseCookiesViewer.propTypes = {
  showCookiesModal: PropTypes.func.isRequired,
  cookiesSent: PropTypes.bool.isRequired,
  cookiesStored: PropTypes.bool.isRequired,
  headers: PropTypes.array.isRequired,
  handleShowRequestSettings: PropTypes.func.isRequired
};

export default ResponseCookiesViewer;

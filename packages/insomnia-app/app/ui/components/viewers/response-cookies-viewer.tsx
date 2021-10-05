import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';
import { Cookie } from 'tough-cookie';

import { AUTOBIND_CFG } from '../../../common/constants';

interface Props {
  showCookiesModal: Function;
  cookiesSent?: boolean | null;
  cookiesStored?: boolean | null;
  headers: any[];
  handleShowRequestSettings: Function;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class ResponseCookiesViewer extends PureComponent<Props> {
  renderRow(h, i) {
    let cookie: Cookie | undefined | null = null;

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
    const { headers, showCookiesModal, cookiesSent, cookiesStored } = this.props;
    const notifyNotStored = !cookiesStored && headers.length;
    let noticeMessage: string | null = null;

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
              Automatic {noticeMessage} of cookies was disabled at the time this request was made
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
          <tbody>{!headers.length ? this.renderRow(null, -1) : headers.map(this.renderRow)}</tbody>
        </table>
        <p className="pad-top">
          <button className="pull-right btn btn--clicky" onClick={() => showCookiesModal()}>
            Manage Cookies
          </button>
        </p>
      </div>
    );
  }
}

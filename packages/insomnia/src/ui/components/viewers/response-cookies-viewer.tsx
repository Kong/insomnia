import React, { type FC, useState } from 'react';
import { Cookie } from 'tough-cookie';

import { CookiesModal } from '../modals/cookies-modal';

interface Props {
  cookiesSent?: boolean | null;
  cookiesStored?: boolean | null;
  headers: any[];
}

export const ResponseCookiesViewer: FC<Props> = props => {
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const renderRow = (h: any, i: number) => {
    let cookie: Cookie | undefined | null = null;

    try {
      cookie = h ? Cookie.parse(h.value || '', { loose: true }) : null;
    } catch (err) {
      console.warn('Failed to parse set-cookie header', h);
    }

    const blank = <span className="super-duper-faint italic">--</span>;
    return <tr className="selectable" key={i}>
      <td>{cookie ? cookie.key : blank}</td>
      <td className="force-wrap">{cookie ? cookie.value : blank}</td>
    </tr>;
  };

  const {
    headers,
    cookiesSent,
    cookiesStored,
  } = props;
  const notifyNotStored = !cookiesStored && headers.length;
  let noticeMessage: string | null = null;

  if (!cookiesSent && notifyNotStored) {
    noticeMessage = 'sending and storing';
  } else if (!cookiesSent) {
    noticeMessage = 'sending';
  } else if (notifyNotStored) {
    noticeMessage = 'storing';
  }

  return <div>
    {noticeMessage && <div className="notice info margin-bottom no-margin-top">
      <p>
        Automatic {noticeMessage} of cookies was disabled at the time this request was made
      </p>
    </div>}

    <table className="table--fancy table--striped table--compact">
      <thead>
        <tr>
          <th>Name</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>{!headers.length ? renderRow(null, -1) : headers.map(renderRow)}</tbody>
    </table>
    <p className="pad-top">
      <button className="pull-right btn btn--clicky" onClick={() => setIsCookieModalOpen(true)}>
        Manage Cookies
      </button>
    </p>
    {isCookieModalOpen && (
      <CookiesModal setIsOpen={setIsCookieModalOpen} />
    )}
  </div>;
};

import { cookieToString } from 'insomnia-cookies';
import React, { FC, useCallback } from 'react';
import { Cookie as ToughCookie } from 'tough-cookie';
import { v4 as uuidv4 } from 'uuid';

import { Cookie } from '../../models/cookie-jar';
import { Dropdown } from './base/dropdown/dropdown';
import { DropdownButton } from './base/dropdown/dropdown-button';
import { DropdownItem } from './base/dropdown/dropdown-item';
import { PromptButton } from './base/prompt-button';
import { showModal } from './modals';
import { CookieModifyModal } from './modals/cookie-modify-modal';
import { RenderedText } from './rendered-text';

export interface CookieListProps {
  handleCookieAdd: (cookie: Cookie) => void;
  handleCookieDelete: (cookie: Cookie) => void;
  handleDeleteAll: () => void;
  cookies: Cookie[];
  newCookieDomainName: string;
}

// Use tough-cookie MAX_DATE value
// https://github.com/salesforce/tough-cookie/blob/5ae97c6a28122f3fb309adcd8428274d9b2bd795/lib/cookie.js#L77
const MAX_TIME = 2147483647000;

const CookieRow: FC<{
  cookie: Cookie;
  index: number;
  deleteCookie: (cookie: Cookie) => void;
}> = ({ cookie, index, deleteCookie }) => {

  const cookieString = cookieToString(ToughCookie.fromJSON(cookie));
  return <tr className="selectable" key={index}>
    <td>
      <RenderedText>{cookie.domain || ''}</RenderedText>
    </td>
    <td className="force-wrap wide">
      <RenderedText>{cookieString || ''}</RenderedText>
    </td>
    <td onClick={() => { }} className="text-right no-wrap">
      <button
        className="btn btn--super-compact btn--outlined"
        onClick={() => showModal(CookieModifyModal, { cookie })}
        title="Edit cookie properties"
      >
        Edit
      </button>{' '}
      <PromptButton
        className="btn btn--super-compact btn--outlined"
        confirmMessage=""
        onClick={() => deleteCookie(cookie)}
        title="Delete cookie"
      >
        <i className="fa fa-trash-o" />
      </PromptButton>
    </td>
  </tr>;

};

export const CookieList: FC<CookieListProps> = ({
  cookies,
  handleDeleteAll,
  handleCookieAdd,
  newCookieDomainName,
  handleCookieDelete,
}) => {
  const addCookie = useCallback(() => handleCookieAdd({
    id: uuidv4(),
    key: 'foo',
    value: 'bar',
    domain: newCookieDomainName,
    expires: MAX_TIME as unknown as Date,
    path: '/',
    secure: false,
    httpOnly: false,
  }), [newCookieDomainName, handleCookieAdd]);

  return <div>
    <table className="table--fancy cookie-table table--striped">
      <thead>
        <tr>
          <th
            style={{
              minWidth: '10rem',
            }}
          >
            Domain
          </th>
          <th
            style={{
              width: '90%',
            }}
          >
            Cookie
          </th>
          <th
            style={{
              width: '2rem',
            }}
            className="text-right"
          >
            <Dropdown right>
              <DropdownButton title="Add cookie" className="btn btn--super-duper-compact btn--outlined txt-md">
                Actions <i className="fa fa-caret-down" />
              </DropdownButton>
              <DropdownItem onClick={addCookie}>
                <i className="fa fa-plus-circle" /> Add Cookie
              </DropdownItem>
              <DropdownItem onClick={handleDeleteAll} buttonClass={PromptButton}>
                <i className="fa fa-trash-o" /> Delete All
              </DropdownItem>
            </Dropdown>
          </th>
        </tr>
      </thead>
      <tbody key={cookies.length}>
        {cookies.map((cookie, i) => (
          <CookieRow
            cookie={cookie}
            index={i}
            key={i}
            deleteCookie={handleCookieDelete}
          />
        ))}
      </tbody>
    </table>
    {cookies.length === 0 && <div className="pad faint italic text-center">
      <p>I couldn't find any cookies for you.</p>
      <p>
        <button className="btn btn--clicky" onClick={addCookie}>
          Add Cookie <i className="fa fa-plus-circle" />
        </button>
      </p>
    </div>}
  </div>;
};

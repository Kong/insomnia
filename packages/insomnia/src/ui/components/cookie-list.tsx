import React, { FC, useCallback, useState } from 'react';
import { Cookie as ToughCookie } from 'tough-cookie';
import { v4 as uuidv4 } from 'uuid';

import { cookieToString } from '../../common/cookies';
import { Cookie } from '../../models/cookie-jar';
import { Dropdown, DropdownButton, DropdownItem, ItemContent } from './base/dropdown';
import { PromptButton } from './base/prompt-button';
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
  const [isCookieModalOpen, setIsCookieModalOpen] = useState(false);
  const c = ToughCookie.fromJSON(cookie);
  const cookieString = c ? cookieToString(c) : '';
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
        onClick={() => setIsCookieModalOpen(true)}
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
      {isCookieModalOpen && (
        <CookieModifyModal
          cookie={cookie}
          onHide={() => setIsCookieModalOpen(false)}
        />
      )}
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
            <Dropdown
              aria-label='Cookie Actions Dropdown'
              triggerButton={
                <DropdownButton
                  title="Add cookie"
                  className="btn btn--super-duper-compact btn--outlined txt-md"
                  disableHoverBehavior={false}
                >
                  Actions <i className="fa fa-caret-down" />
                </DropdownButton>
              }
            >
              <DropdownItem aria-label='Add Cookie'>
                <ItemContent
                  icon="plus-circle"
                  label="Add Cookie"
                  onClick={addCookie}
                />
              </DropdownItem>
              <DropdownItem aria-label='Delete All'>
                <ItemContent
                  icon="trash-o"
                  label="Delete All"
                  withPrompt
                  onClick={handleDeleteAll}
                />
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

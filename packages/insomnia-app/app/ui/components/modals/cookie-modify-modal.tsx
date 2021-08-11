import { autoBindMethodsForReact } from 'class-autobind-decorator';
import clone from 'clone';
import { cookieToString } from 'insomnia-cookies';
import { update } from 'ramda';
import React, { createRef, Fragment, FunctionComponent, PureComponent, useCallback, useState } from 'react';
import * as toughCookie from 'tough-cookie';
import { unreachable } from 'ts-assert-unreachable';

import { AUTOBIND_CFG, KONG_INITIAL_COMMIT_TIMESTAMP, TOUGH_COOKIE_MAX_TIMESTAMP } from '../../../common/constants';
import { HandleGetRenderContext, HandleRender } from '../../../common/render';
import * as models from '../../../models';
import type { Cookie, CookieJar } from '../../../models/cookie-jar';
import Modal, { ModalProps } from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalFooter from '../base/modal-footer';
import ModalHeader from '../base/modal-header';
import OneLineEditor from '../codemirror/one-line-editor';
import { showModal } from '.';

interface Props extends ModalProps {
  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
  nunjucksPowerUserMode: boolean;
  isVariableUncovered: boolean;
  cookieJar: CookieJar;
}

const capitalize = (input: string) => `${input.charAt(0).toUpperCase()}${input.slice(1)}`;

const placeholders = {
  key: 'foo',
  value: 'bar',
  domain: 'example.com',
  path: '/',
  expires: new Date(KONG_INITIAL_COMMIT_TIMESTAMP).toUTCString(),
};

const getCookieString = (cookie: Cookie) => {
  try {
    return cookieToString(cookie);
  } catch (err) {
    console.warn('Failed to parse cookie string', err);
    return null;
  }
};

interface CookieModifyModalInternalProps {
  updateCookie: (cookie: Cookie) => void;
  cookie: Cookie;

  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
  nunjucksPowerUserMode: boolean;
  isVariableUncovered: boolean;
}

export const CookieModifyModalInternal: FunctionComponent<CookieModifyModalInternalProps> = ({
  cookie,
  handleGetRenderContext,
  handleRender,
  isVariableUncovered,
  nunjucksPowerUserMode,
  updateCookie,
}) => {
  const [stateRawString, setStateRawString] = useState('');

  const handleChange = useCallback((field: string) => (eventOrValue: string | React.ChangeEvent<HTMLInputElement>) => {
    let value: string | boolean = '';

    if (typeof eventOrValue === 'string') {
      value = eventOrValue.trim();
    } else if (eventOrValue.target instanceof HTMLInputElement) {
      if (eventOrValue.target.type === 'checkbox') {
        value = eventOrValue.target.checked;
      } else {
        value = eventOrValue.target.value.trim();
      }
    } else {
      unreachable(`change for field "${field}" has an unexpected value ${eventOrValue}`);
    }

    const newCookie = {
      ...cookie,
      [field]: value,
    } as Cookie;

    updateCookie(newCookie);

    const cookieString = getCookieString(newCookie);
    if (cookieString !== null) {
      setStateRawString(cookieString);
    }
  }, [cookie, updateCookie]);

  const renderField = useCallback((field: string, error: string | null = null) => (
    <div className="form-control form-control--outlined">
      <label>
        {capitalize(field)} <span className="danger">{error}</span>
        <OneLineEditor
          placeholder={placeholders[field]}
          render={handleRender}
          getRenderContext={handleGetRenderContext}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          isVariableUncovered={isVariableUncovered}
          defaultValue={cookie[field] ?? ''}
          onChange={handleChange(field)}
        />
      </label>
    </div>
  ), [cookie, handleChange, handleGetRenderContext, handleRender, isVariableUncovered, nunjucksPowerUserMode]);

  const validateExpires = useCallback(() => {
    if (cookie.expires === null) {
      return null;
    }

    const utcDate = new Date(cookie.expires || '').getTime();
    if (isNaN(utcDate)) {
      return 'Invalid Date';
    }
    if (utcDate > TOUGH_COOKIE_MAX_TIMESTAMP) {
      const maxTimestamp = new Date(TOUGH_COOKIE_MAX_TIMESTAMP).toUTCString();
      return `expiration date "${cookie.expires}" is greater than the max allowable timestamp by our cookie implementation (tough-cookie): ${maxTimestamp}`;
    }

    return null;
  }, [cookie]);

  const updateRawValue = useCallback((event: React.SyntheticEvent<HTMLInputElement>) => {
    const { value } = event.currentTarget;
    setStateRawString(value);

    // handle case where the user is intentionally clearing the input
    if (value === '') {
      console.log('clearing');
      updateCookie({
        domain: '',
        expires: '',
        httpOnly: false,
        id: cookie.id,
        key: '',
        path: '',
        secure: false,
        value: '',
      });
      return;
    }

    try {
      // NOTE: Perform toJSON so we have a plain JS object instead of Cookie instance
      // @ts-expect-error -- TSCONVERSION need to update toughCookie to get Cookie type
      const newCookie: Cookie | undefined = toughCookie.Cookie.parse(value)?.toJSON();
      if (!newCookie) {
        throw new Error();
      }

      updateCookie({
        ...newCookie,
        id: cookie.id, // make the new cookie has the same id as the current
      });
    } catch (err) {
      console.warn(`Failed to parse cookie string "${value}"`, err);
    }
  }, [cookie, updateCookie, setStateRawString]);

  console.log({
    getRawCookieString: getCookieString(cookie),
    stateRawString,
    cookie,
  });

  return (
    <Fragment>
      <div className="pad">
        <div className="form-row">
          {renderField('key')}
          {renderField('value')}
        </div>
        <div className="form-row">
          {renderField('domain')}
          {renderField('path')}
        </div>
        {renderField('expires', validateExpires())}
      </div>

      <div className="pad no-pad-top cookie-modify__checkboxes row-around txt-lg">
        {['secure', 'httpOnly'].map(field => (
          <label key={field}>
            {capitalize(field)}
            <input
              className="space-left"
              type="checkbox"
              checked={Boolean(cookie[field])}
              onChange={handleChange(field)}
            />
          </label>
        ))}
      </div>

      <div className="pad">
        <div className="form-control form-control--outlined">
          <label>
            Raw Cookie String
            <input
              type="text"
              onChange={updateRawValue}
              value={stateRawString}
            />
          </label>
        </div>
      </div>
    </Fragment>
  );
};

interface CookieModifyModalState {
  cookie: Cookie | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class CookieModifyModal extends PureComponent<Props, CookieModifyModalState> {
  modal = createRef<Modal>();

  state: CookieModifyModalState = {
    cookie: null,
  }

  async show(cookie: Cookie) {
    const { cookieJar } = this.props;
    const oldCookie = cookieJar.cookies.find(({ id }) => id === cookie.id);

    if (!oldCookie) {
      // Cookie not found in jar
      console.error(`cookie with the id "${cookie.id}" not found`);
      return;
    }

    this.setState({ cookie });
    this.modal.current?.show();
  }

  hide() {
    this.setState({ cookie: null });
    this.modal.current?.hide();
  }

  async updateCookie(cookie: Cookie) {
    console.log('updateCookie', cookie);

    // Sanitize expires field
    const expires = new Date(cookie.expires || '').getTime();
    if (isNaN(expires)) {
      cookie.expires = null;
    } else {
      cookie.expires = expires;
    }

    // deep clone so we don't modify the original
    const cookieJar = clone(this.props.cookieJar);
    const index = cookieJar.cookies.findIndex(c => c.id === cookie.id);

    if (index < 0) {
      console.warn(`Could not find cookie with id=${cookie.id} to edit`);
      return;
    }

    cookieJar.cookies = update(index, cookie, cookieJar.cookies);
    this.setState({ cookie });
    await models.cookieJar.update(cookieJar);
  }

  render() {
    const { cookie } = this.state;
    const {
      handleGetRenderContext,
      handleRender,
      isVariableUncovered,
      nunjucksPowerUserMode,
    } = this.props;
    return (
      <Modal ref={this.modal} {...this.props}>
        <ModalHeader>Edit Cookie</ModalHeader>

        <ModalBody className="cookie-modify">
          {cookie ? (
            <CookieModifyModalInternal
              cookie={cookie}
              handleGetRenderContext={handleGetRenderContext}
              handleRender={handleRender}
              isVariableUncovered={isVariableUncovered}
              nunjucksPowerUserMode={nunjucksPowerUserMode}
              updateCookie={this.updateCookie}
            />
          ) : null}
        </ModalBody>
        <ModalFooter>
          <button className="btn" onClick={this.hide}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

export const showCookieModifyModal = (cookie: Cookie) => showModal(CookieModifyModal, cookie);

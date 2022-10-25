import { autoBindMethodsForReact } from 'class-autobind-decorator';
import deepEqual from 'deep-equal';
import React, { ChangeEvent, forwardRef, ForwardRefRenderFunction, PureComponent } from 'react';
import { useSelector } from 'react-redux';

import { AUTOBIND_CFG } from '../../../common/constants';
import { fuzzyMatch } from '../../../common/misc';
import { HandleRender } from '../../../common/render';
import * as models from '../../../models';
import type { Cookie, CookieJar } from '../../../models/cookie-jar';
import { useNunjucks } from '../../context/nunjucks/use-nunjucks';
import { selectActiveCookieJar } from '../../redux/selectors';
import { Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { CookieList } from '../cookie-list';
import { showModal } from '.';

interface Props extends ModalProps {
  handleRender: HandleRender;
  activeCookieJar: CookieJar | null;
}

interface State {
  filter: string;
  visibleCookieIndexes: number[] | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class CookiesModal extends PureComponent<Props, State> {
  modal: Modal | null = null;
  filterInput: HTMLInputElement | null = null;

  state: State = {
    filter: '',
    visibleCookieIndexes: null,
  };

  _setModalRef(modal: Modal) {
    this.modal = modal;
  }

  _setFilterInputRef(filterInput: HTMLInputElement) {
    this.filterInput = filterInput;
  }

  async _saveChanges() {
    const { activeCookieJar } = this.props;
    if (!activeCookieJar) {
      return;
    }
    await models.cookieJar.update(activeCookieJar);
    await this._applyFilter(this.state.filter, activeCookieJar?.cookies || []); // Force re-render on cookie list
  }

  async _handleCookieAdd(cookie: Cookie) {
    const { activeCookieJar } = this.props;
    if (!activeCookieJar) {
      return;
    }
    const { cookies } = activeCookieJar;
    activeCookieJar.cookies = [cookie, ...cookies];
    await this._saveChanges();
  }

  async _handleDeleteAllCookies() {
    const { activeCookieJar } = this.props;
    if (!activeCookieJar) {
      return;
    }
    activeCookieJar.cookies = [];
    await this._saveChanges();
  }

  async _handleCookieDelete(cookie: Cookie) {
    const { activeCookieJar } = this.props;
    if (!activeCookieJar) {
      return;
    }
    const { cookies } = activeCookieJar;
    // NOTE: This is sketchy because it relies on the same reference
    activeCookieJar.cookies = cookies.filter(c => c.id !== cookie.id);
    await this._saveChanges();
  }

  async _handleFilterChange(event: ChangeEvent<HTMLInputElement>) {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }
    const { activeCookieJar } = this.props;
    if (!activeCookieJar) {
      return;
    }

    const filter = event.target.value;

    this._applyFilter(filter, activeCookieJar.cookies);
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    const { activeCookieJar } = this.props;
    if (!activeCookieJar || !nextProps.activeCookieJar) {
      return;
    }
    // Re-filter if we received new cookies
    // Compare cookies with Dates cast to strings
    const sameCookies = deepEqual(activeCookieJar.cookies, nextProps.activeCookieJar.cookies);

    if (!sameCookies) {
      this._applyFilter(this.state.filter, nextProps.activeCookieJar.cookies);
    }
  }

  async _applyFilter(filter: string, cookies: Cookie[]) {
    const renderedCookies: Cookie[] = [];

    for (const cookie of cookies) {
      try {
        const renderedCookie = await this.props.handleRender(cookie);
        renderedCookies.push(renderedCookie);
      } catch (err) {
        // It's okay. Filter the raw version instead
        renderedCookies.push(cookie);
      }
    }

    let visibleCookieIndexes;

    if (filter) {
      visibleCookieIndexes = [];

      for (let i = 0; i < renderedCookies.length; i++) {
        const toSearch = JSON.stringify(renderedCookies[i]);
        const match = fuzzyMatch(filter, toSearch, {
          splitSpace: true,
        });

        if (match) {
          visibleCookieIndexes.push(i);
        }
      }
    } else {
      visibleCookieIndexes = null;
    }

    this.setState({
      filter,
      visibleCookieIndexes,
    });
  }

  _getVisibleCookies(): Cookie[] {
    const { activeCookieJar } = this.props;
    const { visibleCookieIndexes } = this.state;

    if (!activeCookieJar) {
      return [];
    }

    if (visibleCookieIndexes === null) {
      return activeCookieJar.cookies;
    }

    return activeCookieJar.cookies.filter((_, i) => visibleCookieIndexes.includes(i));
  }

  async show() {
    const { activeCookieJar } = this.props;

    setTimeout(() => {
      this.filterInput?.focus();
    }, 100);

    // make sure the filter is up to date
    await this._applyFilter(this.state.filter, activeCookieJar?.cookies || []);
    this.modal?.show();
  }

  hide() {
    this.modal?.hide();
  }

  render() {
    const { activeCookieJar } = this.props;
    const { filter } = this.state;

    const cookies = this._getVisibleCookies();

    return (
      <Modal ref={this._setModalRef} wide tall {...this.props}>
        <ModalHeader>Manage Cookies</ModalHeader>
        <ModalBody noScroll>
          {activeCookieJar && (
            <div className="cookie-list">
              <div className="pad">
                <div className="form-control form-control--outlined">
                  <label>
                    Filter Cookies
                    <input
                      ref={this._setFilterInputRef}
                      onChange={this._handleFilterChange}
                      type="text"
                      placeholder="twitter.com"
                      defaultValue=""
                    />
                  </label>
                </div>
              </div>
              <div className="cookie-list__list border-tops pad">
                <CookieList
                  cookies={cookies}
                  handleDeleteAll={this._handleDeleteAllCookies}
                  handleCookieAdd={this._handleCookieAdd}
                  handleCookieDelete={this._handleCookieDelete} // Set the domain to the filter so that it shows up if we're filtering
                  newCookieDomainName={filter || 'domain.com'}
                />
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <div className="margin-left faint italic txt-sm">
            * cookies are automatically sent with relevant requests
          </div>
          <button className="btn" onClick={this.hide}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}

const CookiesModalFCRF: ForwardRefRenderFunction<CookiesModal, Omit<Props, 'handleRender' | 'activeCookieJar'>> = (props, ref) => {
  const { handleRender } = useNunjucks();
  const activeCookieJar = useSelector(selectActiveCookieJar);

  return (
    <CookiesModal
      ref={ref}
      activeCookieJar={activeCookieJar}
      {...props}
      handleRender={handleRender}
    />
  );

};

export const CookiesModalFC = forwardRef(CookiesModalFCRF);

export const showCookiesModal = () => showModal(CookiesModal);

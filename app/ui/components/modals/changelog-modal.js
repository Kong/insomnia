import React, {PureComponent} from 'react';
import autobind from 'autobind-decorator';
import Link from '../base/link';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import ModalFooter from '../base/modal-footer';
import {getAppVersion, CHANGELOG_URL, CHANGELOG_PAGE, isDevelopment} from '../../../common/constants';
import * as querystring from '../../../common/querystring';

@autobind
class ChangelogModal extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {
      changelog: null
    };
  }

  _setModalRef (m) {
    this.modal = m;
  }

  show () {
    this.modal.show();
  }

  hide () {
    this.modal.hide();
  }

  toggle () {
    this.modal.toggle();
  }

  async componentDidMount () {
    let changelog;
    try {
      // TODO: Implement release channels
      // NOTE: We add current version to break CDN cache
      const params = [
        {name: 'v', value: getAppVersion()},
        {name: 'channel', value: 'stable'}
      ];

      // Add extra param during dev so we don't affect CDN cache
      if (isDevelopment()) {
        params.push({name: 'dev'});
      }

      const qs = querystring.buildFromParams(params);
      const url = querystring.joinUrl(CHANGELOG_URL, qs);
      const response = await window.fetch(url);
      changelog = await response.json();
    } catch (e) {
      console.warn('Failed to fetch changelog', e);
      return;
    }

    this.setState({changelog});
  }

  render () {
    const {changelog} = this.state;

    let html;

    if (!changelog) {
      html = [
        <div key="spinner" className="txt-lg">
          <i className="fa fa-refresh fa-spin"/>
        </div>
      ];
    } else {
      html = [];

      const startVersion = getAppVersion();
      let startIndex = changelog.findIndex(c => c.version === startVersion);
      if (startIndex < 0) {
        startIndex = 0;
      }

      changelog.slice(startIndex).map((change, i) => {
        html = [
          ...html,
          <h1 key={`changes.${i}`}>v{change.version} Changes</h1>
        ];

        if (change.summary) {
          if (!Array.isArray(change.summary)) {
            html = [
              ...html,
              <p key={`summary.${i}`}>{change.summary}</p>
            ];
          } else {
            html = [
              ...html,
              <p key={`summary.${i}`}><strong>{change.summary[0]}</strong></p>,
              ...change.summary.slice(1).map(
                (text, j) => <p key={`summary.${i}[${j}]`}>{text}</p>
              )
            ];
          }
        }

        if (change.link) {
          html = [
            ...html,
            <Link href={change.link} className="btn btn--clicky" button key={`link.${i}`}>
              Read More
            </Link>
          ];
        }

        const printThing = (text, key) => {
          const match = text.match(/\(PR:(\d+)(:([^)]+))?\)/);
          let link = null;
          if (match) {
            const prNumber = match[1];
            const user = match[3] || '';
            text = text.replace(match[0], '');
            link = (
              <Link href={`https://github.com/getinsomnia/insomnia/pull/${prNumber}`}>
                #{prNumber}
                {user ? ` by ${user}` : null}
              </Link>
            );
          }

          return <li key={key}>{text}{link && '('}{link}{link && ')'}</li>;
        };

        if (change.major && change.major.length) {
          html = [
            ...html,
            <h3 key={`major.${i}`}>Major</h3>,
            <ul key={`major.${i}.list`}>
              {change.major.map(printThing)}
            </ul>
          ];
        }

        if (change.fixes && change.fixes.length) {
          html = [
            ...html,
            <h3 key={`fixes.${i}`}>Bug Fixes</h3>,
            <ul key={`fixes.${i}.list`}>
              {change.fixes.map(printThing)}
            </ul>
          ];
        }

        if (change.minor && change.minor.length) {
          html = [
            ...html,
            <h3 key={`minor.${i}`}>Minor</h3>,
            <ul key={`minor.${i}.list`}>
              {change.minor.map(printThing)}
            </ul>
          ];
        }

        html = [
          ...html,
          <hr key={`hr.${i}`}/>
        ];
      });
    }

    return (
      <Modal tall ref={this._setModalRef} {...this.props}>
        <ModalHeader>Insomnia Changelog</ModalHeader>
        <ModalBody className="pad changelog">
          {html}
        </ModalBody>
        <ModalFooter>
          <Link className="btn" href={CHANGELOG_PAGE} button>
            Visit Full Changelog
          </Link>
        </ModalFooter>
      </Modal>
    );
  }
}

ChangelogModal.propTypes = {};

export default ChangelogModal;

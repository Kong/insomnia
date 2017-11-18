// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import {trackEvent} from '../../../common/analytics';
import * as misc from '../../../common/misc';

type Props = {|
  href: string,
  title?: string,
  button?: boolean,
  onClick?: Function,
  children?: React.Node
|};

@autobind
class Link extends React.PureComponent<Props> {
  _handleClick (e: SyntheticEvent<HTMLAnchorElement>) {
    e && e.preventDefault();
    const {href, onClick} = this.props;

    // Also call onClick that was passed to us if there was one
    onClick && onClick(e);

    misc.clickLink(href);
    trackEvent('Link', 'Click', href);
  }

  render () {
    const {
      onClick, // eslint-disable-line no-unused-vars
      button,
      href,
      children,
      ...other
    } = this.props;
    return button
      ? <button onClick={this._handleClick} {...other}>{children}</button>
      : <a href={href} onClick={this._handleClick} {...other}>{children}</a>;
  }
}

export default Link;

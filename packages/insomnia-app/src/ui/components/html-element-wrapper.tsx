import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { Component } from 'react';

import { AUTOBIND_CFG } from '../../common/constants';

interface Props {
  el: HTMLElement;
  onUnmount?: () => void;
}

/**
 * This component provides an easy way to place a raw DOM node inside a React
 * application. This was created to facilitate the layer between UI plugins
 * and the Insomnia application.
 */
@autoBindMethodsForReact(AUTOBIND_CFG)
export class HtmlElementWrapper extends Component<Props> {
  _setRef(n: HTMLDivElement | null | undefined) {
    if (!n) {
      return;
    }

    // Add the element directly to the React ref
    n.innerHTML = '';
    n.appendChild(this.props.el);
  }

  componentWillUnmount() {
    const { onUnmount } = this.props;

    if (typeof onUnmount === 'function') {
      onUnmount();
    }
  }

  render() {
    return <div ref={this._setRef} />;
  }
}

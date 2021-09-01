import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { PureComponent, ReactNode } from 'react';
import ReactDOM from 'react-dom';

import { AUTOBIND_CFG } from '../../common/constants';

interface Props {
  children: ReactNode;
  message: ReactNode;
  position?: 'bottom' | 'top' | 'right' | 'left';
  className?: string;
  delay?: number;
  selectable?: boolean;
  wide?: boolean;
}

interface State {
  left: number | null;
  top: number | null;
  bottom: number | null;
  right: number | null;
  maxWidth: number | null;
  maxHeight: number | null;
  visible: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class Tooltip extends PureComponent<Props, State> {
  _showTimeout: NodeJS.Timeout | null = null;
  _hideTimeout: NodeJS.Timeout | null = null;
  _tooltip: HTMLDivElement | null = null;
  _bubble: HTMLDivElement | null = null;
  _id = String(Math.random());

  state: State = {
    left: null,
    top: null,
    bottom: null,
    right: null,
    maxWidth: null,
    maxHeight: null,
    visible: false,
  };

  _setTooltipRef(n: HTMLDivElement) {
    this._tooltip = n;
  }

  _setBubbleRef(n: HTMLDivElement) {
    this._bubble = n;
  }

  _handleStopClick(event: React.MouseEvent<HTMLDivElement>) {
    event.stopPropagation();
  }

  _handleMouseEnter() {
    if (this._showTimeout !== null) {
      clearTimeout(this._showTimeout);
    }
    if (this._hideTimeout !== null) {
      clearTimeout(this._hideTimeout);
    }

    this._showTimeout = setTimeout((): void => {
      const tooltip = this._tooltip;
      const bubble = this._bubble;

      if (!tooltip) {
        return;
      }

      if (!bubble) {
        return;
      }

      const tooltipRect = tooltip.getBoundingClientRect();
      const bubbleRect = bubble.getBoundingClientRect();
      const margin = 3;
      let left = 0;
      let top = 0;

      switch (this.props.position) {
        case 'right':
          top = tooltipRect.top - bubbleRect.height / 2 + tooltipRect.height / 2;
          left = tooltipRect.left + tooltipRect.width + margin;
          break;

        case 'left':
          top = tooltipRect.top - bubbleRect.height / 2 + tooltipRect.height / 2;
          left = tooltipRect.left - bubbleRect.width - margin;
          break;

        case 'bottom':
          top = tooltipRect.top + tooltipRect.height + margin;
          left = tooltipRect.left - bubbleRect.width / 2 + tooltipRect.width / 2;
          break;

        case 'top':
        default:
          top = tooltipRect.top - bubbleRect.height - margin;
          left = tooltipRect.left - bubbleRect.width / 2 + tooltipRect.width / 2;
          break;
      }

      bubble.style.left = `${Math.max(0, left)}px`;
      bubble.style.top = `${Math.max(0, top)}px`;
      this.setState({
        visible: true,
      });
    }, this.props.delay || 400);
  }

  _handleMouseLeave() {
    if (this._showTimeout !== null) {
      clearTimeout(this._showTimeout);
    }
    if (this._hideTimeout !== null) {
      clearTimeout(this._hideTimeout);
    }
    this._hideTimeout = setTimeout(() => {
      this.setState({
        visible: false,
      });
      const bubble = this._bubble;

      if (!bubble) {
        return;
      }

      // Reset positioning stuff
      bubble.style.left = '';
      bubble.style.top = '';
      bubble.style.bottom = '';
      bubble.style.right = '';
    }, 100);
  }

  _getContainer(): HTMLElement {
    let container = document.querySelector('#tooltips-container');

    if (!container) {
      container = document.createElement('div');
      container.id = 'tooltips-container';
      // @ts-expect-error -- TSCONVERSION
      container.style.zIndex = '1000000';
      // @ts-expect-error -- TSCONVERSION
      container.style.position = 'relative';
      document.body && document.body.appendChild(container);
    }

    // @ts-expect-error -- TSCONVERSION
    return container;
  }

  componentDidMount() {
    // Move the element to the body so we can position absolutely
    if (this._bubble) {
      const el = ReactDOM.findDOMNode(this._bubble);
      el && this._getContainer().appendChild(el);
    }
  }

  componentWillUnmount() {
    // Remove the element from the body
    if (this._bubble) {
      const el = ReactDOM.findDOMNode(this._bubble);
      el && this._getContainer().removeChild(el);
    }
  }

  render() {
    const { children, message, className, selectable, wide } = this.props;
    const { visible } = this.state;

    if (!message) {
      return children;
    }

    const tooltipClasses = classnames(className, 'tooltip');
    const bubbleClasses = classnames('tooltip__bubble theme--tooltip', {
      'tooltip__bubble--visible': visible,
      'tooltip__bubble--wide': wide,
      selectable: selectable,
    });
    return (
      <div
        className={tooltipClasses}
        ref={this._setTooltipRef}
        id={this._id}
        onMouseEnter={this._handleMouseEnter}
        onMouseLeave={this._handleMouseLeave}
      >
        <div
          className={bubbleClasses}
          onClick={this._handleStopClick}
          role="tooltip"
          aria-hidden={!visible}
          aria-describedby={this._id}
          ref={this._setBubbleRef}
        >
          {message}
        </div>
        {children}
      </div>
    );
  }
}

export default Tooltip;
